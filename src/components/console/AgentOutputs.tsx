"use client";

import type { RunState } from "./state";

/** One line per agent: what it produced in this run. Each line jumps to that agent's section. */
export function AgentOutputs({ s, onJump }: { s: RunState; onJump: (section: string) => void }) {
  const applies = s.clauses.filter((c) => c.applicability === "applies").length;
  const quant = s.obligations.filter((o) => o.kind === "quantitative").length;
  const m = s.mapping;
  const rows: { agent: string; section: string; out?: string }[] = [
    { agent: "Conductor", section: "mesh", out: s.steps.length ? `Found 6 agents by Agent Card; ${s.a2a.filter((r) => r.phase === "proposal" && r.state === "TASK_STATE_COMPLETED").length} A2A tasks completed` : undefined },
    { agent: "Reader", section: "circular", out: s.clauses.length ? `${s.clauses.length} clauses; ${applies} bind this bank` : undefined },
    { agent: "Extractor", section: "obligations", out: s.obligations.length ? `${s.obligations.length} obligations (${quant} with a number), every quote verified${s.rejected.length ? `; ${s.rejected.length} rejected` : ""}` : undefined },
    { agent: "Mapper", section: "mapping", out: m ? `${m.modify.length} to change, ${m.gaps.length} new, ${m.conflicts.length} policy conflict, ${m.manualControls.length} manual` : undefined },
    {
      agent: "Author",
      section: "drafts",
      out: s.drafts.length ? s.drafts.map((d) => `${d.ruleId} ${d.yaml.match(/op: "([^"]+)"/)?.[1] ?? ""} ${d.yaml.match(/value: ([\d.]+)/)?.[1] ?? ""}%`).join(" · ") : undefined,
    },
    {
      agent: "Validator",
      section: "backtest",
      out: s.testsTotal
        ? `${s.testsTotal.passed}/${s.testsTotal.total} tests pass, ${s.objections.length} objection${s.objections.length === 1 ? "" : "s"}${s.backtest ? `; alerts ${s.backtest.impact.oldAlerts} → ${s.backtest.impact.newAlerts} over ${s.backtest.impact.days} days` : ""}`
        : undefined,
    },
    {
      agent: "Release",
      section: "rollout",
      out: s.verify
        ? s.verify.ok
          ? `${s.days.length ? `Day ${s.days[s.days.length - 1].index}, ${s.days[s.days.length - 1].phase}` : "Signatures verified"}${s.rollbacks.length ? `; ${s.rollbacks.length} rollback` : ""}`
          : "Refused: approvals did not verify"
        : undefined,
    },
  ];
  return (
    <ol className="m-0 p-0">
      {rows.map((r) => (
        <li key={r.agent} className="list-none">
          <button type="button" onClick={() => onJump(r.section)} disabled={!r.out} className="ui grid w-full cursor-pointer grid-cols-[10px_1fr] gap-2 px-1 py-2 text-left hover:bg-surface disabled:cursor-default disabled:hover:bg-transparent">
            <span className={`mt-1.5 h-2 w-2 ${r.out ? "bg-ok" : "bg-surface-2"}`} />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink">{r.agent}</span>
              <span className={`block text-[12.5px] leading-snug ${r.out ? "text-ink" : "text-soft"}`}>{r.out ?? "Waiting"}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
