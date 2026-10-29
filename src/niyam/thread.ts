import { CIRCULAR } from "./data/circular";
import { EXISTING_RULES } from "./data/seed";
import { toYaml } from "./dsl/schema";
import type { AlertRecord, ApprovalView, ReleaseBundle, ThreadView } from "./events";

/**
 * Golden Thread: Alert -> Rule version -> Approvals -> Obligation -> Clause -> Circular.
 * Pure function over the run's records so the server, the UI and the CLI all trace the same way.
 */
export function buildThread(
  alert: AlertRecord,
  bundle: ReleaseBundle,
  approvals: ApprovalView[],
  commits: Record<string, string> = {},
): ThreadView {
  if (alert.mode === "v1" || alert.version === 1) {
    const r = EXISTING_RULES.find((x) => x.rule_id === alert.ruleId);
    return {
      alert,
      rule: { ruleId: alert.ruleId, version: 1, yaml: r ? toYaml(r) : "", title: r?.title ?? alert.ruleId, commit: commits["seed"] },
      approvals: [],
      circular: { ref: r?.source.circular ?? "MD-SYN-LEF-2025", title: "Master Direction on Large Exposures (SYNTHETIC)", issuedOn: "2025-04-01", synthetic: true },
      clause: r ? { number: r.source.clause, text: r.source.span, span: r.source.span, start: 0, end: r.source.span.length } : undefined,
    };
  }
  const draft = bundle.drafts.find((d) => d.ruleId === alert.ruleId);
  const ob = bundle.obligations.find((o) => o.id === draft?.obligationId);
  const clause = bundle.clauses.find((c) => c.id === ob?.clauseId);
  const impact = bundle.impact.rules.find((r) => r.ruleId === alert.ruleId);
  return {
    alert,
    rule: {
      ruleId: alert.ruleId,
      version: draft?.version ?? alert.version,
      yaml: draft?.yaml ?? "",
      title: draft?.title ?? alert.ruleId,
      commit: commits[alert.ruleId],
    },
    approvals: approvals.filter((a) => a.ruleId === alert.ruleId).map((a) => a.payload),
    obligation: ob,
    clause: clause && ob ? { number: clause.number, text: clause.text, span: ob.span, start: ob.spanStart, end: ob.spanEnd } : undefined,
    circular: { ref: CIRCULAR.ref, title: CIRCULAR.title, issuedOn: CIRCULAR.issuedOn, synthetic: true },
    backtest: impact ? { oldAlerts: impact.oldAlerts, newAlerts: impact.newAlerts, days: bundle.impact.days } : undefined,
  };
}

export function formatThread(t: ThreadView): string {
  const lines = [
    `ALERT       ${t.alert.id}  ${t.alert.subject} at ${t.alert.metricValue.toFixed(2)}% on ${t.alert.day} (${t.alert.mode})`,
    `  RULE      ${t.rule.ruleId} v${t.rule.version} "${t.rule.title}"${t.rule.commit ? `  commit ${t.rule.commit}` : ""}`,
    ...t.approvals.map((a) => `  APPROVAL  ${a.approver_name}, ${a.role}  sha256 ${a.rule_sha256.slice(0, 16)}...  ${a.issued_at}`),
    t.obligation ? `  OBLIG.    ${t.obligation.id}: fire when ${t.obligation.metric} ${t.obligation.operator} ${t.obligation.threshold}` : "",
    t.clause ? `  CLAUSE    para ${t.clause.number}: "${t.clause.span}"` : "",
    `  CIRCULAR  ${t.circular.ref}  ${t.circular.title}`,
    t.backtest ? `  BACKTEST  ${t.backtest.oldAlerts} -> ${t.backtest.newAlerts} alerts over ${t.backtest.days} days` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
