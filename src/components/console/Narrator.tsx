"use client";

import type { RunState } from "./state";

/** The ten workflow stages a person watches, and the section each one lives in. */
export const STAGES = [
  { key: "read", label: "Read", section: "circular" },
  { key: "extract", label: "Extract", section: "obligations" },
  { key: "map", label: "Map", section: "mapping" },
  { key: "draft", label: "Draft", section: "drafts" },
  { key: "validate", label: "Validate", section: "drafts" },
  { key: "backtest", label: "Backtest", section: "backtest" },
  { key: "approve", label: "Approve", section: "approval" },
  { key: "release", label: "Release", section: "rollout" },
  { key: "monitor", label: "Monitor", section: "rollout" },
  { key: "trace", label: "Trace", section: "thread" },
] as const;

export interface Narration {
  stage: number; // -1 before a run
  text: string;
  section: string;
}

/** Turn the run state into one plain sentence about what is happening right now. */
export function narrate(s: RunState): Narration {
  const live = s.llmCalls.find((c) => c.status === "running");
  const agentName = (a: string) => (a === "extractor" ? "Extractor" : a === "author" ? "Author" : a);

  if (s.status === "idle") return { stage: -1, text: "Choose your bank and a circular below, then press Run. Every step will be explained here as it happens.", section: "setup" };
  if (s.status === "error") return { stage: -1, text: `Something went wrong: ${s.error}`, section: "setup" };

  if (s.thread) {
    return { stage: 9, text: `Golden Thread: alert ${s.thread.alert.id} traces back through ${s.thread.rule.ruleId} v${s.thread.rule.version} and its approvers to the exact words of para ${s.thread.clause?.number ?? "?"}.`, section: "thread" };
  }
  if (s.status === "refused") return { stage: 6, text: `Release refused: ${s.verify?.reason ?? "approvals did not verify"}. Nothing was deployed.`, section: "rollout" };
  if (s.rollbacks.length) {
    const r = s.rollbacks[s.rollbacks.length - 1];
    return { stage: 8, text: `The Sentinel caught drift and rolled ${r.ruleId} back to v${r.toVersion} automatically: ${r.reason}.`, section: "rollout" };
  }
  if (s.days.length) {
    const d = s.days[s.days.length - 1];
    const word = d.phase === "shadow" ? "in shadow mode, logging only" : d.phase === "canary" ? "on a 10% canary" : "live for everyone";
    return { stage: d.phase === "live" ? 8 : 7, text: `Rollout day ${d.index}: the new rules run ${word}, and the Sentinel checks each day against the backtest forecast.`, section: "rollout" };
  }
  if (s.status === "releasing") return { stage: 7, text: "Release is verifying both signatures against the exact rule files before anything is promoted.", section: "rollout" };
  if (s.status === "awaiting" && s.bundle) {
    if (!s.bundle.drafts.length) return { stage: 6, text: "This circular needs no rule changes for your bank. Mapping and manual controls are listed above.", section: "mapping" };
    return { stage: 6, text: `Stopped for humans: ${s.bundle.drafts.length} rule change(s), ${s.bundle.testsPassed}/${s.bundle.testsTotal} tests passing. Two different people must now sign before anything can go live.`, section: "approval" };
  }
  if (live) return { stage: live.agent === "extractor" ? 1 : 3, text: `The ${agentName(live.agent)} is asking Claude: ${live.task.toLowerCase()}. Watch the answer being written below; NIYAM checks it before using it.`, section: "claude" };
  if (s.backtest) return { stage: 5, text: `Backtest done: ${s.backtest.impact.oldAlerts} alerts under today's rules becomes ${s.backtest.impact.newAlerts} under the new ones over ${s.backtest.impact.days} days.`, section: "backtest" };
  if (s.objections.length && s.testsTotal) {
    return { stage: 4, text: `The Validator objected, the Author fixed it, and now ${s.testsTotal.passed}/${s.testsTotal.total} tests written from the circular pass.`, section: "drafts" };
  }
  if (s.objections.length) {
    const o = s.objections[s.objections.length - 1].objection;
    return { stage: 4, text: `The Validator objected to ${o.ruleId}: expected ${o.expected.split(";")[0]}, found ${o.found.split(";")[0]}. The Author must fix it.`, section: "drafts" };
  }
  if (s.testsTotal) return { stage: 4, text: `The Validator challenged every draft: ${s.testsTotal.passed}/${s.testsTotal.total} tests written from the circular pass.`, section: "drafts" };
  if (s.drafts.length) return { stage: 3, text: `The Author has drafted ${s.drafts.length} rule change(s) on a draft branch. The Validator will now test them against the clause.`, section: "drafts" };
  if (s.mapping) {
    const m = s.mapping;
    return { stage: 2, text: `The Mapper found ${m.modify.length} rule(s) to change, ${m.gaps.length} gap(s) needing a new rule, ${m.conflicts.length} policy conflict(s) and ${m.manualControls.length} manual control(s).`, section: "mapping" };
  }
  if (s.obligations.length) {
    const q = s.obligations.filter((o) => o.kind === "quantitative").length;
    return { stage: 1, text: `The Extractor turned the binding clauses into ${s.obligations.length} obligations (${q} with a number to enforce), each quoting its exact source words.`, section: "obligations" };
  }
  if (s.clauses.length) {
    const n = s.clauses.filter((c) => c.applicability === "applies").length;
    return { stage: 0, text: `The Reader split the circular into ${s.clauses.length} clauses; ${n} bind your bank and the rest are informational or for other licence types.`, section: "circular" };
  }
  return { stage: 0, text: "The Conductor is finding its agents by their Agent Cards and checking that each can only use its own tools.", section: "mesh" };
}

export function Narrator({ s, follow, setFollow }: { s: RunState; follow: boolean; setFollow: (v: boolean) => void }) {
  const n = narrate(s);
  const running = s.status === "running" || s.status === "releasing";
  return (
    <div data-ui className="bg-ink text-white">
      <div className="wrap py-3">
        <ol className="scrollbar-none m-0 flex gap-1 overflow-x-auto p-0" aria-label="Workflow stages">
          {STAGES.map((st, i) => {
            const done = n.stage > i;
            const now = n.stage === i;
            return (
              <li
                key={st.key}
                className={`flex shrink-0 list-none items-center gap-1.5 px-2.5 py-1 text-[12.5px] transition-colors ${now ? "bg-accent text-white" : done ? "bg-white/15 text-white" : "bg-white/5 text-white/55"}`}
                aria-current={now ? "step" : undefined}
              >
                <span className={`h-1.5 w-1.5 ${now && running ? "pulse bg-white" : done ? "bg-[#6ee7b7]" : "bg-white/40"}`} />
                {st.label}
              </li>
            );
          })}
        </ol>
        <div className="mt-2.5 flex flex-wrap items-start justify-between gap-3">
          <p key={n.text} className="rise max-w-[110ch] text-[15px] leading-snug" aria-live="polite">
            {n.text}
          </p>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12.5px] text-white/80">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="h-3.5 w-3.5 accent-[#1d4ed8]" />
            Follow along
          </label>
        </div>
      </div>
    </div>
  );
}
