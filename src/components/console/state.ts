"use client";

import type {
  AlertRecord,
  ApprovalView,
  BacktestSeries,
  DraftView,
  ImpactSummary,
  ReleaseBundle,
  RolloutDay,
  RunEvent,
  ThreadView,
} from "@/niyam/events";
import type { McpCallRecord, RolloutState } from "@/niyam/context";
import type { Clause, MappingResult, Objection, Obligation, RejectedObligation, TestResult } from "@/niyam/types";

export interface StepRow {
  id: string;
  agent: string;
  title: string;
  status: string;
  detail?: string;
  ms?: number;
  phase: "proposal" | "release";
}

export interface A2ARow {
  from: string;
  to: string;
  skill: string;
  state: string;
  summary: string;
  taskId: string;
  phase: "proposal" | "release";
}

export interface RunState {
  status: "idle" | "running" | "awaiting" | "releasing" | "released" | "refused" | "error";
  meta?: Extract<RunEvent, { type: "meta" }>;
  steps: StepRow[];
  a2a: A2ARow[];
  mcp: McpCallRecord[];
  guardrails: Extract<RunEvent, { type: "guardrail" }>[];
  clauses: Clause[];
  effectiveFrom?: string;
  obligations: Obligation[];
  rejected: RejectedObligation[];
  mapping?: MappingResult;
  drafts: DraftView[];
  draftHistory: DraftView[];
  objections: { objection: Objection; round: number }[];
  tests: Record<string, TestResult[]>;
  testsTotal?: { passed: number; total: number };
  backtest?: { series: BacktestSeries; impact: ImpactSummary };
  bundle?: ReleaseBundle;
  approvals: ApprovalView[];
  verify?: { ok: boolean; reason?: string };
  promote?: { commit: string };
  rollout: Record<string, RolloutState>;
  days: RolloutDay[];
  rollbacks: Extract<RunEvent, { type: "rollback" }>[];
  alerts: AlertRecord[];
  thread?: ThreadView;
  logs: { level: string; text: string }[];
  error?: string;
  proposalMs?: number;
  releaseMs?: number;
}

export const initialState: RunState = {
  status: "idle",
  steps: [],
  a2a: [],
  mcp: [],
  guardrails: [],
  clauses: [],
  obligations: [],
  rejected: [],
  drafts: [],
  draftHistory: [],
  objections: [],
  tests: {},
  approvals: [],
  rollout: {},
  days: [],
  rollbacks: [],
  alerts: [],
  logs: [],
};

export type Action =
  | { type: "reset" }
  | { type: "start" }
  | { type: "start_release" }
  | { type: "event"; event: RunEvent }
  | { type: "approve"; approvals: ApprovalView[] }
  | { type: "error"; message: string };

export function reducer(s: RunState, a: Action): RunState {
  switch (a.type) {
    case "reset":
      return initialState;
    case "start":
      return { ...initialState, status: "running" };
    case "start_release":
      return {
        ...s,
        status: "releasing",
        verify: undefined,
        promote: undefined,
        rollout: {},
        days: [],
        rollbacks: [],
        alerts: [],
        thread: undefined,
        releaseMs: undefined,
        steps: s.steps.filter((x) => x.phase === "proposal").map((x) => (x.id === "human" ? { ...x, status: "done", detail: "Signed by both approvers" } : x)),
        a2a: s.a2a.filter((x) => x.phase === "proposal"),
      };
    case "approve": {
      const keep = s.approvals.filter((x) => !a.approvals.some((n) => n.ruleId === x.ruleId && n.payload.approver_id === x.payload.approver_id));
      return { ...s, approvals: [...keep, ...a.approvals] };
    }
    case "error":
      return { ...s, status: "error", error: a.message };
    case "event":
      return applyEvent(s, a.event);
  }
}

function applyEvent(s: RunState, e: RunEvent): RunState {
  const phase: "proposal" | "release" = s.status === "releasing" || s.status === "released" ? "release" : "proposal";
  switch (e.type) {
    case "meta":
      return { ...s, meta: e };
    case "step": {
      const steps = [...s.steps];
      const i = steps.findIndex((x) => x.id === e.id && x.phase === phase);
      const row = { id: e.id, agent: e.agent, title: e.title, status: e.status, detail: e.detail, ms: e.ms, phase };
      if (i >= 0) steps[i] = row;
      else steps.push(row);
      return { ...s, steps };
    }
    case "a2a":
      return { ...s, a2a: [...s.a2a, { from: e.from, to: e.to, skill: e.skill, state: e.state, summary: e.summary, taskId: e.taskId, phase }] };
    case "mcp":
      return { ...s, mcp: [...s.mcp, e.call] };
    case "guardrail":
      return { ...s, guardrails: [...s.guardrails, e] };
    case "clauses":
      return { ...s, clauses: e.clauses, effectiveFrom: e.effectiveFrom };
    case "obligations":
      return { ...s, obligations: e.obligations, rejected: e.rejected };
    case "mapping":
      return { ...s, mapping: e.mapping };
    case "draft": {
      const exists = s.drafts.some((d) => d.ruleId === e.draft.ruleId);
      const drafts = exists ? s.drafts.map((d) => (d.ruleId === e.draft.ruleId ? e.draft : d)) : [...s.drafts, e.draft];
      return { ...s, drafts, draftHistory: [...s.draftHistory, e.draft] };
    }
    case "objection":
      return { ...s, objections: [...s.objections, { objection: e.objection, round: e.round }] };
    case "tests":
      return { ...s, tests: { ...s.tests, [e.ruleId]: e.results } };
    case "tests_total":
      return { ...s, testsTotal: { passed: e.passed, total: e.total } };
    case "backtest":
      return { ...s, backtest: { series: e.series, impact: e.impact } };
    case "approval_pack":
      return { ...s, bundle: e.bundle, status: "awaiting" };
    case "approvals_verified":
      return { ...s, verify: { ok: e.ok, reason: e.reason }, status: e.ok ? s.status : "refused" };
    case "promote":
      return { ...s, promote: { commit: e.commit } };
    case "rollout":
      return { ...s, rollout: { ...s.rollout, [e.state.ruleId]: e.state } };
    case "day":
      return { ...s, days: [...s.days, e.day] };
    case "rollback":
      return {
        ...s,
        rollbacks: [...s.rollbacks, e],
        rollout: { ...s.rollout, [e.ruleId]: { ruleId: e.ruleId, version: e.toVersion, mode: "rolled_back", canaryPct: 0 } },
      };
    case "alerts":
      return { ...s, alerts: e.alerts };
    case "thread":
      return { ...s, thread: e.thread };
    case "log":
      return { ...s, logs: [...s.logs, { level: e.level, text: e.text }] };
    case "error":
      return { ...s, status: "error", error: e.message };
    case "done":
      if (e.phase === "proposal") return { ...s, proposalMs: e.ms };
      return { ...s, releaseMs: e.ms, status: s.status === "refused" ? "refused" : "released" };
  }
  return s;
}

/** POST and read a server-sent event stream. */
export async function streamEvents(url: string, body: unknown, onEvent: (e: RunEvent) => void, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = chunk
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      if (data) onEvent(JSON.parse(data));
    }
  }
}
