import { parseRule } from "../dsl/schema";
import { generateTests } from "../dsl/testgen";
import type { NiyamContext } from "../context";
import type { AgentTools } from "../mcp/client";
import type { AlertRow } from "../sql/engine";
import type { BacktestSeries, ImpactSummary, RuleImpact } from "../events";
import { interpretComparator } from "./extractor";
import type { Objection, Obligation, RuleDraft, TestResult } from "../types";

/**
 * Validator: an independent challenger. It never edits a draft; it compares the draft with the
 * obligation, runs tests generated from the clause, and objects to the Author over A2A.
 */

export const MINUTES_PER_ALERT = 45;

export interface ValidationOutcome {
  ok: boolean;
  objection?: Objection;
  results: TestResult[];
}

export function ensureTests(ctx: NiyamContext, ruleId: string, ob: Obligation) {
  if (ctx.tests.some((t) => t.ruleId === ruleId)) return;
  const boardOverrideTest = !!ctx.mapping?.conflicts.some((c) => c.obligationId === ob.id);
  ctx.tests.push(...generateTests(ruleId, ob, { boardOverrideTest }));
}

export async function validateDraft(ctx: NiyamContext, tools: AgentTools, draft: RuleDraft): Promise<ValidationOutcome> {
  const ob = ctx.obligations.find((o) => o.id === draft.obligationId)!;
  await tools.call("dsl_validate", { yaml: draft.yaml });
  const rule = parseRule(draft.yaml);
  ensureTests(ctx, rule.rule_id, ob);

  const codes: string[] = [];
  const expected: string[] = [];
  const found: string[] = [];

  if (rule.when.op !== ob.operator) {
    const meaning = interpretComparator(ob.comparatorPhrase ?? "")?.meaning ?? "";
    codes.push("OP-FIDELITY");
    expected.push(`op "${ob.operator}" because para ${ob.clauseNumber} says "${ob.comparatorPhrase}" (${meaning})`);
    found.push(`op "${rule.when.op}"`);
  }
  if (rule.when.value !== ob.threshold) {
    codes.push("THRESHOLD");
    expected.push(`value ${ob.threshold}`);
    found.push(`value ${rule.when.value}`);
  }
  if (rule.when.metric !== ob.metric) {
    codes.push("METRIC");
    expected.push(`metric ${ob.metric}`);
    found.push(`metric ${rule.when.metric}`);
  }
  if (rule.when.unit !== ob.unit) {
    codes.push("UNIT");
    expected.push(`unit ${ob.unit}`);
    found.push(`unit ${rule.when.unit}`);
  }
  const scopeA = [...rule.applies_to].sort().join(",");
  const scopeB = [...ob.scope].sort().join(",");
  if (scopeA !== scopeB) {
    codes.push("SCOPE");
    expected.push(`applies_to [${scopeB}]`);
    found.push(`applies_to [${scopeA}]`);
  }
  if (rule.source.span !== ob.span) {
    codes.push("SPAN");
    expected.push(`span "${ob.span}"`);
    found.push(`span "${rule.source.span}"`);
  }
  const forbidsOverride = ctx.obligations.some(
    (o) => o.action === "policy_constraint" && o.span.includes(`paragraph ${ob.clauseNumber}`),
  );
  if (rule.unless && forbidsOverride) {
    const c = ctx.obligations.find((o) => o.action === "policy_constraint")!;
    codes.push("POLICY-OVERRIDE");
    expected.push(`no "unless: ${rule.unless}" because para ${c.clauseNumber}: "${c.span}"`);
    found.push(`unless: ${rule.unless}`);
  }

  const results = await tools.call<TestResult[]>("bt_run_tests", { yaml: draft.yaml });
  const failing = results.filter((r) => !r.pass);
  if (failing.length && !codes.length) {
    codes.push("TESTS");
    expected.push("all generated tests pass");
    found.push(`${failing.length} failing`);
  }
  ctx.testResults = [...ctx.testResults.filter((r) => r.ruleId !== rule.rule_id), ...results];

  if (!codes.length) return { ok: true, results };

  const seq = ctx.objections.length + 1;
  const objection: Objection = {
    id: `OBJ-${rule.rule_id.slice(4)}-${String(seq).padStart(2, "0")}`,
    ruleId: rule.rule_id,
    code: codes.join("+"),
    clause: ob.clauseNumber,
    span: ob.span,
    expected: expected.join("; "),
    found: found.join("; "),
    evidence: failing.length
      ? failing.map((f) => `${f.name} (${f.given}): expected ${f.expectFire ? "fire" : "no fire"}, rule ${f.fired ? "fired" : "did not fire"}`).join("; ")
      : "Static check against the obligation",
    failingTests: failing.map((f) => f.id),
  };
  ctx.objections.push(objection);
  return { ok: false, objection, results };
}

function stats(xs: number[]) {
  const mean = xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(xs.length - 1, 1));
  return { mean, sd };
}

export async function runBacktest(ctx: NiyamContext, tools: AgentTools) {
  const dates = (ctx.book.exec("SELECT DISTINCT as_of FROM capital ORDER BY as_of")[0]?.values ?? []).map((v) => String(v[0]));
  const series: BacktestSeries = { dates, old: dates.map(() => 0), new: dates.map(() => 0) };
  const idx = new Map(dates.map((d, i) => [d, i]));
  const rules: RuleImpact[] = [];
  let newlyFlagged = 0;

  for (const d of ctx.drafts) {
    const res = await tools.call<{ old: AlertRow[]; new: AlertRow[] }>("bt_run_backtest", {
      old_yaml: d.previousYaml,
      new_yaml: d.yaml,
    });
    const perDayNew = dates.map(() => 0);
    for (const r of res.old) series.old[idx.get(r.as_of)!] += 1;
    for (const r of res.new) {
      series.new[idx.get(r.as_of)!] += 1;
      perDayNew[idx.get(r.as_of)!] += 1;
    }
    const oldSubjects = new Set(res.old.map((r) => r.subject_id));
    const newSubjects = new Set(res.new.map((r) => r.subject_id));
    const added = [...newSubjects].filter((s) => !oldSubjects.has(s));
    newlyFlagged += added.length;
    const st = stats(perDayNew);
    rules.push({
      ruleId: d.rule.rule_id,
      title: d.rule.title,
      oldAlerts: res.old.length,
      newAlerts: res.new.length,
      oldSubjects: oldSubjects.size,
      newSubjects: newSubjects.size,
      addedSubjects: added,
      forecastMean: st.mean,
      forecastSd: st.sd,
    });
  }

  const oldAlerts = rules.reduce((a, r) => a + r.oldAlerts, 0);
  const newAlerts = rules.reduce((a, r) => a + r.newAlerts, 0);
  const impact: ImpactSummary = {
    days: dates.length,
    oldAlerts,
    newAlerts,
    deltaPct: oldAlerts ? ((newAlerts - oldAlerts) / oldAlerts) * 100 : 100,
    analystHours: Math.round(((newAlerts - oldAlerts) * MINUTES_PER_ALERT) / 60),
    minutesPerAlert: MINUTES_PER_ALERT,
    newlyFlaggedSubjects: newlyFlagged,
    boardItems: newlyFlagged,
    rules,
  };
  return { series, impact };
}
