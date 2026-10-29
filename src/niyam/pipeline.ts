import { AGENTS, buildCard, type AgentId } from "./a2a/cards";
import { closeTools, registerSkill, toolsFor, A2AClient } from "./a2a/runtime";
import { authorDraft, authorWorklist, draftDiff } from "./agents/author";
import { extractClause, runExtractor } from "./agents/extractor";
import { runMapper } from "./agents/mapper";
import { runReader, segment } from "./agents/reader";
import { runReleaseAgent, type ReleaseInput } from "./agents/release";
import { runBacktest, validateDraft } from "./agents/validator";
import { DRAFT_BRANCH, type NiyamContext } from "./context";
import { compileRule } from "./dsl/compile";
import { parseRule } from "./dsl/schema";
import type { DraftView, ReleaseBundle } from "./events";
import { LLM_MODEL, llmAvailable } from "./llm/claude";
import { ToolDeniedError } from "./mcp/client";
import { ENGINE_LABEL } from "./sql/engine";
import { buildThread } from "./thread";
import type { Clause, Objection, RuleDraft } from "./types";

export const MAX_OBJECTION_ROUNDS = 3;

function draftView(d: RuleDraft & { round?: number }): DraftView {
  let sql: string | undefined;
  try {
    sql = compileRule(d.rule).sql;
  } catch {
    sql = undefined;
  }
  return {
    ruleId: d.rule.rule_id,
    version: d.rule.version,
    kind: d.kind,
    obligationId: d.obligationId,
    yaml: d.yaml,
    diff: draftDiff(d),
    commit: d.commit ?? "",
    round: d.round ?? 1,
    sql,
  };
}

let registered = false;
export function registerSkills() {
  if (registered) return;
  registered = true;

  registerSkill("reader", "segment-and-scope", async (ctx, input) => {
    if (input?.text) {
      const { clauses, effectiveFrom } = segment(input.ref ?? "RBI-USER-000", String(input.text), input.entityType ?? ctx.profile.entityType);
      return { data: { clauses, effectiveFrom }, text: `Segmented ${clauses.length} clauses` };
    }
    const res = await runReader(ctx, toolsFor(ctx, "reader"));
    const n = res.clauses.filter((c) => c.applicability === "applies").length;
    return { data: res, text: `${res.clauses.length} clauses; ${n} apply to ${ctx.profile.entityType}` };
  });

  registerSkill("extractor", "extract-obligations", async (ctx, input) => {
    if (input?.clause?.text) {
      const clause: Clause = {
        id: "CL-USER-1",
        number: input.clause.number ?? "1",
        text: String(input.clause.text),
        applicability: "applies",
        reason: "Provided by caller",
        scope: input.clause.scope ?? ["UCB"],
      };
      const { metricForText } = await import("./data/semanticModel");
      const obligations = extractClause(clause, "RBI-USER-000", input.effectiveFrom ?? "unspecified", (t) => metricForText(t)?.id ?? null);
      return { data: { obligations }, text: `${obligations.length} obligation(s); every span verified as an exact substring` };
    }
    const res = await runExtractor(ctx, toolsFor(ctx, "extractor"), input?.effectiveFrom ?? "unspecified");
    return {
      data: res,
      text: `${res.obligations.length} obligations verified, ${res.rejected.length} rejected (${res.usedLlm ? `LLM: ${LLM_MODEL}` : "rule-based"})`,
    };
  });

  registerSkill("mapper", "map-obligations", async (ctx) => {
    const m = await runMapper(ctx, toolsFor(ctx, "mapper"));
    return {
      data: m,
      text: `${m.modify.length} rules to modify, ${m.gaps.length} gap, ${m.conflicts.length} policy conflict, ${m.manualControls.length} manual control`,
    };
  });

  registerSkill("author", "draft-rule", async (ctx, input) => {
    const item = authorWorklist(ctx.mapping!, ctx.obligations).find((w) => w.ruleId === input.ruleId);
    if (!item) throw new Error(`No work item for ${input.ruleId}`);
    const d = await authorDraft(ctx, toolsFor(ctx, "author"), item, 1);
    const view = draftView(d);
    ctx.emit({ type: "draft", draft: view });
    return { data: view, text: `${view.ruleId} v${view.version} committed ${view.commit} on ${DRAFT_BRANCH(ctx.circular.ref)}` };
  });

  registerSkill("author", "resolve-objection", async (ctx, input) => {
    const objection = input.objection as Objection;
    const item = authorWorklist(ctx.mapping!, ctx.obligations).find((w) => w.ruleId === objection.ruleId);
    if (!item) throw new Error(`No work item for ${objection.ruleId}`);
    const d = await authorDraft(ctx, toolsFor(ctx, "author"), item, input.round ?? 2, objection);
    const view = draftView(d);
    ctx.emit({ type: "draft", draft: view });
    return { data: view, text: `Revised ${view.ruleId}: ${d.rationale}; recommitted ${view.commit}` };
  });

  registerSkill("validator", "validate-draft", async (ctx, input, env) => {
    // Public use: validate a caller's YAML against the obligation it cites.
    if (input?.yaml) {
      const rule = parseRule(String(input.yaml));
      const ob = ctx.obligations.find((o) => o.id === rule.source.obligation) ?? ctx.obligations.find((o) => o.clauseNumber === rule.source.clause && o.kind === "quantitative");
      if (!ob) throw new Error(`No obligation for clause ${rule.source.clause} in ${ctx.circular.ref}`);
      const out = await validateDraft(ctx, env.tools, { rule, yaml: String(input.yaml), obligationId: ob.id, kind: "modify" });
      return { data: out, text: out.ok ? "Draft matches the obligation; all tests pass" : `Objection ${out.objection!.code}: expected ${out.objection!.expected}` };
    }

    const ruleId = String(input.ruleId);
    for (let round = 1; round <= MAX_OBJECTION_ROUNDS; round++) {
      const draft = ctx.drafts.find((d) => d.rule.rule_id === ruleId)!;
      const out = await validateDraft(ctx, env.tools, draft);
      ctx.emit({ type: "tests", ruleId, results: out.results, round });
      if (out.ok) {
        return { data: { ok: true, rounds: round, passed: out.results.length }, text: `${ruleId}: ${out.results.length}/${out.results.length} tests pass${round > 1 ? ` after ${round - 1} objection round(s)` : ""}` };
      }
      ctx.emit({ type: "objection", objection: out.objection!, round });
      if (round === MAX_OBJECTION_ROUNDS) {
        return {
          data: { ok: false, rounds: round, objection: out.objection },
          text: `${ruleId}: unresolved after ${round} rounds; escalated to a human with both positions`,
          state: "TASK_STATE_INPUT_REQUIRED",
        };
      }
      await env.a2a.send("author", "resolve-objection", { objection: out.objection, round: round + 1 }, {
        referenceTaskIds: [env.taskId],
        summary: `OBJECTION ${out.objection!.id} ${out.objection!.code}: ${out.objection!.expected}`,
      });
    }
    throw new Error("unreachable");
  });

  registerSkill("validator", "backtest-impact", async (ctx, _input, env) => {
    const res = await runBacktest(ctx, env.tools);
    ctx.emit({ type: "backtest", series: res.series, impact: res.impact });
    return {
      data: res,
      text: `${res.impact.oldAlerts} to ${res.impact.newAlerts} alerts over ${res.impact.days} days; ${res.impact.newlyFlaggedSubjects} newly flagged`,
    };
  });

  registerSkill("release", "release-rule", async (ctx, input, env) => {
    const res = await runReleaseAgent(ctx, env.tools, input as ReleaseInput);
    if (!res.ok) return { data: res, text: `Release refused: ${res.reason}`, state: "TASK_STATE_REJECTED" };
    return {
      data: res,
      text: `Released ${(input as ReleaseInput).bundle.drafts.length} rules; ${res.alerts.length} alerts; ${res.rolledBack.length ? `rolled back ${res.rolledBack.join(", ")}` : "no rollback"}`,
    };
  });

  registerSkill("conductor", "orchestrate-circular", async (ctx) => {
    const bundle = await runProposal(ctx);
    return { data: bundle, text: `Approval pack ready: ${bundle.drafts.length} drafts, ${bundle.testsPassed}/${bundle.testsTotal} tests pass` };
  });
}

async function step<T>(ctx: NiyamContext, id: string, agent: string, title: string, fn: () => Promise<{ value: T; detail: string; status?: "done" | "warn" }>): Promise<T> {
  ctx.emit({ type: "step", id, agent, title, status: "running" });
  const t0 = performance.now();
  try {
    const { value, detail, status } = await fn();
    ctx.emit({ type: "step", id, agent, title, status: status ?? "done", detail, ms: Math.round(performance.now() - t0) });
    return value;
  } catch (e) {
    ctx.emit({ type: "step", id, agent, title, status: "error", detail: (e as Error).message, ms: Math.round(performance.now() - t0) });
    throw e;
  }
}

/** Phase 1: circular to approval pack. Stops at the human gate. */
export async function runProposal(ctx: NiyamContext): Promise<ReleaseBundle> {
  registerSkills();
  const t0 = performance.now();
  const a2a = new A2AClient(ctx, "conductor");
  const llm = ctx.path === "llm" && llmAvailable();
  ctx.emit({
    type: "meta",
    runId: ctx.runId,
    path: llm ? "llm" : "rule-based",
    engine: ENGINE_LABEL,
    llmModel: llm ? LLM_MODEL : undefined,
    startedAt: new Date().toISOString(),
    note: ctx.path === "llm" && !llm ? "LLM path requested but ANTHROPIC_API_KEY is not set; running the rule-based path" : undefined,
  });
  if (ctx.path === "llm" && !llm) ctx.path = "rule-based";

  await step(ctx, "discover", "conductor", "Discover agents by Agent Card skills", async () => {
    const cards = AGENTS.filter((a) => a.id !== "conductor").map((a) => buildCard(a.id, "https://niyam.local"));
    const need = ["segmentation", "extraction", "mapping", "authoring", "validation", "deployment"];
    const found = need.map((tag) => cards.find((c) => c.skills.some((s) => s.tags.includes(tag)))?.name ?? "missing");
    await toolsFor(ctx, "conductor").call("kg_read_circular");
    return { value: found, detail: `${cards.length} workers matched by skill tags: ${found.join(", ")}` };
  });

  await step(ctx, "guardrail", "conductor", "Allowlist self-test (Extractor tries the deploy API)", async () => {
    const extractor = toolsFor(ctx, "extractor");
    let clientMsg = "";
    try {
      await extractor.call("deploy_set_mode", {});
    } catch (e) {
      if (!(e instanceof ToolDeniedError)) throw e;
      clientMsg = (e as Error).message;
    }
    ctx.emit({ type: "guardrail", agent: "extractor", tool: "deploy_set_mode", layer: "client", result: clientMsg });
    const probe = await extractor.probeServerSide("deploy_set_mode", {
      rule_id: "SYN-EXP-012",
      version: 99,
      mode: "live",
      canary_pct: 100,
      yaml: "x",
      tokens: [],
    });
    const serverMsg = probe.body?.error ?? JSON.stringify(probe.body);
    ctx.emit({ type: "guardrail", agent: "extractor", tool: "deploy_set_mode", layer: "server", result: serverMsg });
    return { value: null, detail: "Refused by the agent's MCP client and again by the deploy-monitor server" };
  });

  const reader = await step(ctx, "reader", "reader", "Read the circular and scope it", async () => {
    const r = await a2a.send<{ clauses: Clause[]; effectiveFrom: string }>("reader", "segment-and-scope", {}, { summary: `Segment ${ctx.circular.ref} for ${ctx.profile.entityType}` });
    ctx.emit({ type: "clauses", clauses: r.data.clauses, effectiveFrom: r.data.effectiveFrom });
    return { value: r.data, detail: r.text };
  });

  await step(ctx, "extractor", "extractor", "Extract obligations with verified spans", async () => {
    const r = await a2a.send("extractor", "extract-obligations", { effectiveFrom: reader.effectiveFrom }, { summary: "Extract obligations from applicable clauses" });
    ctx.emit({ type: "obligations", obligations: ctx.obligations, rejected: ctx.rejected });
    return { value: null, detail: r.text };
  });

  const mapping = await step(ctx, "mapper", "mapper", "Map to live rules and policies", async () => {
    const r = await a2a.send("mapper", "map-obligations", {}, { summary: "Map obligations to rules and policies" });
    ctx.emit({ type: "mapping", mapping: ctx.mapping! });
    return { value: ctx.mapping!, detail: r.text, status: ctx.mapping!.conflicts.length ? ("warn" as const) : ("done" as const) };
  });

  const work = authorWorklist(mapping, ctx.obligations);
  await step(ctx, "author", "author", "Draft rules on the draft branch", async () => {
    for (const w of work) await a2a.send("author", "draft-rule", { ruleId: w.ruleId }, { summary: `Draft ${w.ruleId} for para ${w.obligation.clauseNumber}` });
    return { value: null, detail: `${work.length} drafts committed to ${DRAFT_BRANCH(ctx.circular.ref)}` };
  });

  let escalated = 0;
  await step(ctx, "validator", "validator", "Challenge drafts and run generated tests", async () => {
    for (const w of work) {
      const r = await a2a.send("validator", "validate-draft", { ruleId: w.ruleId }, { summary: `Validate ${w.ruleId}` });
      if (r.task.status.state === "TASK_STATE_INPUT_REQUIRED") escalated++;
    }
    const passed = ctx.testResults.filter((t) => t.pass).length;
    ctx.emit({ type: "tests_total", passed, total: ctx.testResults.length });
    return {
      value: null,
      detail: `${passed}/${ctx.testResults.length} tests pass; ${ctx.objections.length} objection(s) raised and resolved over A2A${escalated ? `; ${escalated} escalated` : ""}`,
      status: escalated ? ("warn" as const) : ("done" as const),
    };
  });

  const bt = await step(ctx, "backtest", "validator", "Backtest 90 days, old against new", async () => {
    const r = await a2a.send<{ impact: ReleaseBundle["impact"] }>("validator", "backtest-impact", {}, { summary: "Backtest drafts on the synthetic loan book" });
    return { value: r.data, detail: r.text };
  });

  const bundle: ReleaseBundle = {
    runId: ctx.runId,
    path: ctx.path,
    circularRef: ctx.circular.ref,
    clauses: ctx.clauses,
    obligations: ctx.obligations,
    mapping,
    drafts: ctx.drafts.map((d) => ({ ruleId: d.rule.rule_id, version: d.rule.version, yaml: d.yaml, obligationId: d.obligationId, kind: d.kind, title: d.rule.title })),
    impact: bt.impact,
    testsPassed: ctx.testResults.filter((t) => t.pass).length,
    testsTotal: ctx.testResults.length,
  };
  for (const note of ctx.llmNotes) ctx.emit({ type: "log", level: "info", text: note });
  ctx.emit({ type: "step", id: "human", agent: "human", title: "Two-person approval", status: "blocked", detail: "Waiting for the Chief Compliance Officer and the Head of Risk to sign" });
  ctx.emit({ type: "approval_pack", bundle });
  ctx.emit({ type: "done", phase: "proposal", ms: Math.round(performance.now() - t0) });
  await closeTools(ctx);
  return bundle;
}

/** Phase 2: verify approvals, promote, roll out, watch, roll back. */
export async function runRelease(ctx: NiyamContext, input: ReleaseInput) {
  registerSkills();
  const t0 = performance.now();
  const a2a = new A2AClient(ctx, "conductor");

  // Rehydrate the run from the bundle, but re-derive clause text from the server's own copy of the
  // circular so a tampered bundle cannot change what the Golden Thread quotes.
  const trusted = segment(ctx.circular.ref, ctx.circular.text, ctx.profile.entityType).clauses;
  for (const ob of input.bundle.obligations) {
    const c = trusted.find((x) => x.id === ob.clauseId);
    if (!c || !c.text.includes(ob.span)) throw new Error(`Bundle obligation ${ob.id} does not match the circular text`);
  }
  input.bundle.clauses = trusted;
  ctx.clauses = trusted;
  ctx.obligations = input.bundle.obligations;
  ctx.mapping = input.bundle.mapping;
  for (const d of input.bundle.drafts) {
    await ctx.repo.commitDraft(DRAFT_BRANCH(ctx.circular.ref), `${d.ruleId}.yaml`, d.yaml, `${d.ruleId} v${d.version}: approved draft (rehydrated)`);
  }

  const res = await step(ctx, "release", "release", "Verify approvals and roll out", async () => {
    const r = await a2a.send<any>("release", "release-rule", input, { summary: "Release approved rules" });
    const ok = r.task.status.state === "TASK_STATE_COMPLETED";
    return { value: r.data, detail: r.text, status: ok ? (r.data.rolledBack?.length ? ("warn" as const) : ("done" as const)) : ("warn" as const) };
  });

  if (res.ok && res.alerts.length) {
    const featured =
      res.alerts.find((a: any) => a.ruleId === "SYN-EXP-012" && a.mode === "live") ??
      res.alerts.find((a: any) => a.mode !== "v1") ??
      res.alerts[0];
    ctx.emit({ type: "thread", thread: buildThread(featured, input.bundle, res.approvals, res.commits) });
  }
  ctx.emit({ type: "done", phase: "release", ms: Math.round(performance.now() - t0) });
  await closeTools(ctx);
  return res;
}
