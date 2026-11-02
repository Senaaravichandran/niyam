"use client";

import type { BankDef } from "@/niyam/data/banks";
import type { RunState } from "./state";

/**
 * The run at a glance: seven agents in a row, the one working now, what it is doing for this
 * bank and how, and one result card per agent that has finished. Details live further down.
 */

type AgentId = "conductor" | "reader" | "extractor" | "mapper" | "author" | "validator" | "release";

interface AgentInfo {
  id: AgentId;
  name: string;
  /** What it does, for this bank. */
  doing: (b: BankDef) => string;
  /** How it does it, for this run's path. */
  how: (llm: boolean, model?: string) => string;
  /** Details section to open for this agent. */
  section: string;
}

const AGENTS: AgentInfo[] = [
  {
    id: "conductor",
    name: "Conductor",
    doing: () => "Finding the six specialist agents and handing each its task",
    how: () => "Reads each agent's A2A Agent Card, checks that every agent can only use its own MCP tools",
    section: "mesh",
  },
  {
    id: "reader",
    name: "Reader",
    doing: (b) => `Splitting the circular into clauses and deciding which ones bind ${b.short}`,
    how: () => "Numbered paragraphs become clauses; each is scoped against the bank's licence type through the semantic-model MCP server",
    section: "circular",
  },
  {
    id: "extractor",
    name: "Extractor",
    doing: () => "Turning each binding clause into an obligation with a number, an operator and the exact quote",
    how: (llm, model) =>
      llm
        ? `Claude (${model ?? "LLM"}) proposes the obligations; NIYAM keeps only those whose quote appears word for word in the clause`
        : "Rule-based: comparator phrases such as “exceeding” or “or more” are matched by rules; every quote is checked word for word",
    section: "obligations",
  },
  {
    id: "mapper",
    name: "Mapper",
    doing: (b) => `Comparing the obligations with ${b.short}'s ${b.rules.length} live rules and ${b.policies.length} policy sections`,
    how: () => "Walks the regulatory knowledge graph: what to change, what is missing, which policy conflicts",
    section: "mapping",
  },
  {
    id: "author",
    name: "Author",
    doing: (b) => `Writing ${b.short}'s new rule files on a draft branch`,
    how: (llm, model) =>
      llm
        ? `Claude (${model ?? "LLM"}) drafts each rule in NIYAM's typed rule language; the schema and compiler check it, never raw SQL`
        : "Rule-based: fills the typed rule template from the obligation; the schema and compiler check it",
    section: "drafts",
  },
  {
    id: "validator",
    name: "Validator",
    doing: (b) => `Testing every draft against the circular and replaying it on ${b.short}'s last 90 days`,
    how: () => "Writes boundary tests from the clause (not the draft), objects to the Author over A2A if anything is off, then backtests old against new",
    section: "backtest",
  },
  {
    id: "release",
    name: "Release",
    doing: (b) => `Rolling the signed rules out at ${b.short}: shadow, canary, live`,
    how: () => "Checks both signatures against the exact files, then switches feature flags; the Sentinel rolls back on drift",
    section: "rollout",
  },
];

function statusOf(s: RunState, id: AgentId): "waiting" | "working" | "done" | "error" {
  const steps = s.steps.filter((st) => st.agent === id);
  if (!steps.length) return "waiting";
  if (steps.some((st) => st.status === "running")) return "working";
  if (steps.some((st) => st.status === "error")) return "error";
  return "done";
}

function outputOf(s: RunState, id: AgentId): string | undefined {
  switch (id) {
    case "conductor":
      return s.steps.some((st) => st.agent === "conductor" && st.status === "done") ? `6 agents found by Agent Card · ${s.a2a.filter((r) => r.phase === "proposal" && r.state === "TASK_STATE_COMPLETED").length} tasks done` : undefined;
    case "reader":
      return s.clauses.length ? `${s.clauses.length} clauses · ${s.clauses.filter((c) => c.applicability === "applies").length} bind this bank` : undefined;
    case "extractor":
      return s.obligations.length ? `${s.obligations.length} obligations · ${s.obligations.filter((o) => o.kind === "quantitative").length} with a number · all quotes verified` : undefined;
    case "mapper":
      return s.mapping ? `${s.mapping.modify.length} to change · ${s.mapping.gaps.length} new · ${s.mapping.conflicts.length} policy conflict · ${s.mapping.manualControls.length} manual` : undefined;
    case "author":
      return s.drafts.length ? s.drafts.map((d) => `${d.ruleId} ${d.yaml.match(/op: "([^"]+)"/)?.[1] ?? ""} ${d.yaml.match(/value: ([\d.]+)/)?.[1] ?? ""}%`).join(" · ") : undefined;
    case "validator":
      return s.testsTotal ? `${s.testsTotal.passed}/${s.testsTotal.total} tests pass · ${s.objections.length} objection${s.objections.length === 1 ? "" : "s"}${s.backtest ? ` · alerts ${s.backtest.impact.oldAlerts} → ${s.backtest.impact.newAlerts} in 90 days` : ""}` : undefined;
    case "release":
      if (!s.verify) return undefined;
      if (!s.verify.ok) return "Refused: the approvals did not verify";
      return s.days.length ? `Day ${s.days[s.days.length - 1].index} · ${s.days[s.days.length - 1].phase}${s.rollbacks.length ? ` · ${s.rollbacks.length} rolled back` : ""}` : "Signatures verified";
  }
}

export function LiveView({ s, bank, model, onOpen }: { s: RunState; bank: BankDef; model?: string; onOpen: (section: string) => void }) {
  const llm = s.meta?.path === "llm";
  const active = AGENTS.find((a) => statusOf(s, a.id) === "working");
  const awaiting = s.status === "awaiting";
  const done = AGENTS.filter((a) => outputOf(s, a.id));
  const caption = active
    ? { who: active.name, what: active.doing(bank), how: active.how(llm, model) }
    : awaiting
      ? { who: "Humans", what: `Stopped for two people to sign ${s.bundle?.drafts.length ?? 0} rule change${s.bundle?.drafts.length === 1 ? "" : "s"} for ${bank.short}`, how: "A maker and a checker review the clause, the rule, the tests and the impact, then sign. Nothing reaches the bank without both." }
      : s.status === "released"
        ? { who: "Done", what: `Released at ${bank.short}${s.rollbacks.length ? `, with ${s.rollbacks.length} automatic rollback` : ""}`, how: "Every alert now traces back to the approvers and the exact sentence of the circular." }
        : s.status === "refused"
          ? { who: "Release", what: "Refused. The signed files changed after approval, so nothing was deployed.", how: "Each signature covers the SHA-256 of the exact rule file." }
          : s.status === "idle"
            ? { who: "Ready", what: `Press Run to send the circular through NIYAM's seven agents for ${bank.short}`, how: llm ? "Claude live: the Extractor and Author ask Claude; everything else is deterministic." : "Rule-based: every step is deterministic, no LLM involved." }
            : { who: "Starting", what: "Connecting to the agents", how: "" };

  return (
    <div data-ui className="space-y-4">
      <div className="bg-navy p-5 text-on-navy sm:p-6">
        <ol className="m-0 grid grid-cols-7 gap-1 p-0" aria-label="Agents">
          {AGENTS.map((a) => {
            const st = statusOf(s, a.id);
            return (
              <li key={a.id} className="list-none">
                <div className={`h-1.5 ${st === "done" ? "bg-[#6ee7b7]" : st === "working" ? "pulse bg-white" : st === "error" ? "bg-bad" : "bg-white/15"}`} />
                <p className={`mt-2 truncate text-[12.5px] sm:text-[14px] ${st === "working" ? "font-semibold text-white" : st === "done" ? "text-white" : "text-white/50"}`}>{a.name}</p>
                <p className="hidden text-[11.5px] text-white/50 sm:block">{st === "working" ? "working" : st === "done" ? "done" : st === "error" ? "error" : "waiting"}</p>
              </li>
            );
          })}
        </ol>
        <div key={caption.who + caption.what} className="rise mt-6">
          <p className="ui text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#93b4ff]">{caption.who}</p>
          <p className="mt-1 text-[clamp(20px,2.2vw,30px)] font-semibold leading-tight text-white">{caption.what}</p>
          {caption.how && <p className="mt-2 max-w-[90ch] text-[15px] leading-snug text-white/75">How: {caption.how}</p>}
        </div>
      </div>

      {done.length > 0 && (
        <ul className="m-0 grid gap-2 p-0 md:grid-cols-2 xl:grid-cols-3" aria-label="What each agent produced">
          {done.map((a) => (
            <li key={a.id} className="rise list-none">
              <button type="button" onClick={() => onOpen(a.section)} className="block h-full w-full cursor-pointer bg-surface p-4 text-left transition-colors hover:bg-surface-2">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-ink">{a.name}</span>
                  <span className="text-[12px] text-accent">details ↓</span>
                </span>
                <span className="mt-1 block text-[14.5px] font-semibold leading-snug text-ink">{outputOf(s, a.id)}</span>
                <span className="mt-1 block text-[12.5px] leading-snug text-muted">{a.how(llm, model)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
