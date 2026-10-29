import { metricById } from "../data/semanticModel";
import type { PolicyClause } from "../data/seed";
import type { NiyamContext } from "../context";
import type { AgentTools } from "../mcp/client";
import type { MappingResult, Obligation } from "../types";

/**
 * Mapper: obligations -> the bank's live rules and internal policies, through the knowledge graph.
 * Classifies each obligation as MODIFY (a rule measures the same metric), GAP (no rule does),
 * CONFLICT (a policy permits what the circular now forbids) or MANUAL CONTROL (procedural).
 */

function proposedRuleId(metric: string, taken: Set<string>) {
  const family = metricById(metric)?.grain === "bank" ? "CON" : "EXP";
  for (let n = 20; n < 100; n++) {
    const id = `SYN-${family}-${String(n).padStart(3, "0")}`;
    if (!taken.has(id)) return id;
  }
  throw new Error("No free rule id");
}

export async function runMapper(ctx: NiyamContext, tools: AgentTools): Promise<MappingResult> {
  const obligations = await tools.call<Obligation[]>("kg_read_obligations");
  const result: MappingResult = { modify: [], gaps: [], conflicts: [], manualControls: [] };
  const taken = new Set<string>();
  const policyConstraints = obligations.filter((o) => o.action === "policy_constraint");

  for (const ob of obligations) {
    if (ob.kind === "procedural") {
      if (ob.action === "board_report") {
        result.manualControls.push({
          obligationId: ob.id,
          control: "MC-BRD-30: place every flagged exposure before the Board within 30 days (compliance calendar task, owner: Company Secretary)",
        });
      }
      continue;
    }
    const rules = await tools.call<{ ruleId: string; title: string }[]>("kg_find_rules", { metric: ob.metric });
    if (rules.length) {
      for (const r of rules) {
        taken.add(r.ruleId);
        const current = await tools.call<{ content: string | null }>("git_read_rule", { rule_id: r.ruleId });
        const curValue = current.content?.match(/value:\s*([\d.]+)/)?.[1];
        const curOp = current.content?.match(/op:\s*"([^"]+)"/)?.[1];
        result.modify.push({
          ruleId: r.ruleId,
          obligationId: ob.id,
          change: `Threshold ${curValue ?? "?"} to ${ob.threshold}; circular says "${ob.comparatorPhrase}" (fire on ${ob.operator}), live rule fires on ${curOp ?? "?"}`,
        });
        await tools.call("kg_link_mapping", { from: ob.id, to: r.ruleId, type: "MAPPED_TO", note: "MODIFY" });

        // Policies that implement this rule and permit more than the new limit are conflicts.
        const policies = await tools.call<PolicyClause[]>("kg_find_policies", { rule_id: r.ruleId, metric: ob.metric });
        for (const p of policies) {
          if (p.permits && p.permits.metric === ob.metric && p.permits.upTo > (ob.threshold ?? Infinity)) {
            const constraint = policyConstraints[0];
            result.conflicts.push({
              policyId: p.id,
              policySection: `${p.policy} §${p.section}`,
              obligationId: ob.id,
              detail: `Policy lets the Board approve up to ${p.permits.upTo}% and suppresses the report; para ${ob.clauseNumber} sets ${ob.threshold}%${constraint ? ` and para ${constraint.clauseNumber} forbids any policy override` : ""}.`,
              resolution: `Amend ${p.policy.split(" ")[0]} §${p.section} (policy-update task to Compliance) and drop the "unless: board_approved" exception from ${r.ruleId}.`,
            });
            await tools.call("kg_link_mapping", { from: ob.id, to: p.id, type: "CONFLICTS_WITH", note: "Board override above new limit" });
          }
        }
      }
    } else {
      const ruleId = proposedRuleId(ob.metric!, taken);
      taken.add(ruleId);
      result.gaps.push({ obligationId: ob.id, proposedRuleId: ruleId, reason: `No live rule measures ${metricById(ob.metric!)?.label ?? ob.metric}` });
      await tools.call("kg_link_mapping", { from: ob.id, to: ruleId, type: "MAPPED_TO", note: "GAP: new rule" });
    }
  }
  ctx.mapping = result;
  return result;
}
