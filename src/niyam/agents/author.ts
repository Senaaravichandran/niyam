import { metricById } from "../data/semanticModel";
import { parseRule, toYaml, type Rule } from "../dsl/schema";
import { unifiedDiff } from "../git/repo";
import type { NiyamContext } from "../context";
import type { AgentTools } from "../mcp/client";
import { LLM_MODEL, llmAvailable, llmDraft } from "../llm/claude";
import type { MappingResult, Objection, Obligation, RuleDraft } from "../types";

/**
 * Author: writes rule drafts on the draft branch.
 *
 * The rule-based Author edits an existing rule the way a busy engineer would: a minimal diff that
 * changes the threshold and the source and keeps everything else. That is fast and reviewable,
 * and it is also how a copied ">=" or a stale exception survives into a new version. Catching that
 * is the Validator's job, not the Author's.
 */

export interface AuthorInput {
  obligation: Obligation;
  kind: "modify" | "new";
  ruleId: string;
}

function newRuleFrom(ob: Obligation, ruleId: string, circularRef: string): Rule {
  const metric = metricById(ob.metric!)!;
  return {
    rule_id: ruleId,
    version: 1,
    status: "draft",
    title: metric.grain === "bank" ? "Top 20 borrower concentration" : metric.label,
    applies_to: ob.scope,
    when: { metric: ob.metric!, op: ob.operator!, value: ob.threshold!, unit: "pct" },
    action: ob.action as Rule["action"],
    severity: "high",
    source: { circular: circularRef, clause: ob.clauseNumber, obligation: ob.id, span: ob.span },
  };
}

function minimalDiff(current: Rule, ob: Obligation, circularRef: string): Rule {
  return {
    ...current,
    version: current.version + 1,
    status: "draft",
    when: { ...current.when, value: ob.threshold! },
    source: { circular: circularRef, clause: ob.clauseNumber, obligation: ob.id, span: ob.span },
  };
}

/** Deterministic revision: apply exactly what each objection says. */
function applyObjection(draft: Rule, objection: Objection, ob: Obligation): Rule {
  const next: Rule = JSON.parse(JSON.stringify(draft));
  for (const code of objection.code.split("+")) {
    if (code === "OP-FIDELITY") next.when.op = ob.operator!;
    if (code === "THRESHOLD") next.when.value = ob.threshold!;
    if (code === "POLICY-OVERRIDE") delete next.unless;
    if (code === "SCOPE") next.applies_to = ob.scope;
    if (code === "SPAN") next.source.span = ob.span;
  }
  return next;
}

export async function authorDraft(
  ctx: NiyamContext,
  tools: AgentTools,
  input: AuthorInput,
  round: number,
  objection?: Objection,
): Promise<RuleDraft & { round: number; rationale?: string }> {
  const { obligation: ob, kind, ruleId } = input;
  const main = await tools.call<{ content: string | null }>("git_read_rule", { rule_id: ruleId });
  const previousYaml = main.content ?? undefined;
  const existingDraft = ctx.drafts.find((d) => d.rule.rule_id === ruleId);

  let rule: Rule | undefined;
  let rationale: string | undefined;

  if (ctx.path === "llm" && llmAvailable()) {
    try {
      const current = previousYaml ? parseRule(previousYaml) : undefined;
      let callId = "";
      const out = await llmDraft({
        obligation: ob,
        existingYaml: previousYaml,
        ruleId,
        version: current ? current.version + 1 : 1,
        objection,
        previousDraft: existingDraft?.yaml,
      }, (e) => {
        callId = e.id;
        ctx.emit({ type: "llm", ...e });
      });
      const proposed = parseRule(out.yaml);
      // The model proposes content; identity and lineage are pinned by NIYAM.
      rule = {
        ...proposed,
        rule_id: ruleId,
        version: current ? current.version + 1 : 1,
        status: "draft",
        source: { ...proposed.source, circular: ctx.circular.ref, clause: ob.clauseNumber, obligation: ob.id },
      };
      rationale = out.rationale;
      ctx.llmNotes.push(`Author used ${LLM_MODEL} for ${ruleId} (round ${round})`);
      ctx.emit({ type: "llm_verdict", id: callId, agent: "author", ok: true, summary: `Draft passed the typed DSL schema; committed to the draft branch for the Validator to challenge` });
    } catch (e) {
      ctx.llmNotes.push(`Author LLM call failed for ${ruleId} (${(e as Error).message}); used rule-based drafting`);
      ctx.emit({ type: "llm_verdict", id: "", agent: "author", ok: false, summary: `Claude's draft for ${ruleId} was not accepted (${(e as Error).message}); the rule-based Author drafted it instead` });
      rule = undefined;
    }
  }

  if (!rule) {
    if (objection && existingDraft) {
      rule = applyObjection(existingDraft.rule, objection, ob);
      rationale = `Applied objection ${objection.id}: ${objection.expected}`;
    } else if (kind === "modify" && previousYaml) {
      rule = minimalDiff(parseRule(previousYaml), ob, ctx.circular.ref);
      rationale = "Minimal diff against the live rule: threshold and source updated.";
    } else {
      rule = newRuleFrom(ob, ruleId, ctx.circular.ref);
      rationale = "New rule generated from the obligation.";
    }
  }

  await tools.call("dsl_validate", { yaml: toYaml(rule) });
  const yaml = toYaml(rule);
  const commit = await tools.call<{ short: string; sha: string }>("git_commit_draft", {
    rule_id: ruleId,
    content: yaml,
    message: objection
      ? `${ruleId} v${rule.version}: resolve ${objection.id} (${objection.code})`
      : `${ruleId} v${rule.version}: ${kind === "modify" ? "amend" : "add"} for ${ctx.circular.ref} para ${ob.clauseNumber}`,
  });

  const draft: RuleDraft & { round: number; rationale?: string } = {
    rule,
    yaml,
    previousYaml,
    obligationId: ob.id,
    kind,
    commit: commit.short,
    round,
    rationale,
  };
  ctx.drafts = [...ctx.drafts.filter((d) => d.rule.rule_id !== ruleId), draft];
  return draft;
}

export function draftDiff(d: RuleDraft) {
  return unifiedDiff(d.previousYaml ?? "", d.yaml, d.previousYaml ? `main/${d.rule.rule_id}.yaml` : "/dev/null", `draft/${d.rule.rule_id}.yaml`);
}

/** Work list for the Author: one entry per rule to change or create. */
export function authorWorklist(mapping: MappingResult, obligations: Obligation[]): AuthorInput[] {
  const byId = new Map(obligations.map((o) => [o.id, o]));
  return [
    ...mapping.modify.map((m) => ({ obligation: byId.get(m.obligationId)!, kind: "modify" as const, ruleId: m.ruleId })),
    ...mapping.gaps.map((g) => ({ obligation: byId.get(g.obligationId)!, kind: "new" as const, ruleId: g.proposedRuleId })),
  ];
}
