import type { ExecutionPath, McpCallRecord, RolloutState } from "./context";
import type { ApprovalPayload } from "./approvals/token";
import type { LlmEvent } from "./llm/claude";
import type {
  Clause,
  MappingResult,
  Objection,
  Obligation,
  RejectedObligation,
  StepStatus,
  TestResult,
} from "./types";

export interface DraftView {
  ruleId: string;
  version: number;
  kind: "modify" | "new";
  obligationId: string;
  yaml: string;
  diff: string;
  commit: string;
  round: number;
  sql?: string;
}

export interface BacktestSeries {
  dates: string[];
  old: number[];
  new: number[];
}

export interface RuleImpact {
  ruleId: string;
  title: string;
  oldAlerts: number;
  newAlerts: number;
  oldSubjects: number;
  newSubjects: number;
  addedSubjects: string[];
  forecastMean: number;
  forecastSd: number;
}

export interface ImpactSummary {
  days: number;
  oldAlerts: number;
  newAlerts: number;
  deltaPct: number;
  analystHours: number;
  minutesPerAlert: number;
  newlyFlaggedSubjects: number;
  boardItems: number;
  rules: RuleImpact[];
}

export interface AlertRecord {
  id: string;
  ruleId: string;
  version: number;
  day: string;
  subject: string;
  metricValue: number;
  mode: "shadow" | "canary" | "live" | "v1";
}

export interface RolloutDay {
  day: string;
  index: number;
  phase: "shadow" | "canary" | "live";
  perRule: Record<string, { observed: number; band: [number, number]; z: number; drift: boolean; mode: string }>;
  drifted: boolean;
}

export interface ApprovalView {
  ruleId: string;
  token: string;
  payload: ApprovalPayload;
}

export interface ThreadView {
  alert: AlertRecord;
  rule: { ruleId: string; version: number; yaml: string; commit?: string; title: string };
  approvals: ApprovalPayload[];
  obligation?: Obligation;
  clause?: { number: string; text: string; span: string; start: number; end: number };
  circular: { ref: string; title: string; issuedOn: string; synthetic: boolean };
  backtest?: { oldAlerts: number; newAlerts: number; days: number };
}

export type RunEvent =
  | { type: "meta"; runId: string; path: ExecutionPath; engine: string; llmModel?: string; startedAt: string; note?: string }
  | { type: "step"; id: string; agent: string; title: string; status: StepStatus; detail?: string; ms?: number }
  | { type: "a2a"; from: string; to: string; method: string; skill: string; taskId: string; state: string; summary: string }
  | { type: "mcp"; call: McpCallRecord }
  | { type: "guardrail"; agent: string; tool: string; layer: "client" | "server"; result: string }
  | { type: "clauses"; clauses: Clause[]; effectiveFrom: string }
  | { type: "obligations"; obligations: Obligation[]; rejected: RejectedObligation[] }
  | { type: "mapping"; mapping: MappingResult }
  | { type: "draft"; draft: DraftView }
  | { type: "objection"; objection: Objection; round: number }
  | { type: "tests"; ruleId: string; results: TestResult[]; round: number }
  | { type: "tests_total"; passed: number; total: number }
  | { type: "backtest"; series: BacktestSeries; impact: ImpactSummary }
  | { type: "approval_pack"; bundle: ReleaseBundle }
  | { type: "approvals_verified"; ok: boolean; reason?: string; approvals: ApprovalView[] }
  | { type: "promote"; commit: string; branch: string }
  | { type: "rollout"; state: RolloutState }
  | { type: "day"; day: RolloutDay }
  | { type: "rollback"; ruleId: string; toVersion: number; commit: string; reason: string }
  | { type: "alerts"; alerts: AlertRecord[] }
  | { type: "thread"; thread: ThreadView }
  | ({ type: "llm" } & LlmEvent)
  | { type: "llm_verdict"; id: string; agent: string; ok: boolean; summary: string; details?: string[] }
  | { type: "log"; level: "info" | "warn" | "error"; agent?: string; text: string }
  | { type: "error"; message: string }
  | { type: "done"; phase: "proposal" | "release"; ms: number };

/** Everything the release phase needs, carried by the client between stateless requests. */
export interface ReleaseBundle {
  runId: string;
  path: ExecutionPath;
  circularRef: string;
  clauses: Clause[];
  obligations: Obligation[];
  mapping: MappingResult;
  drafts: { ruleId: string; version: number; yaml: string; obligationId: string; kind: "modify" | "new"; title: string }[];
  impact: ImpactSummary;
  testsPassed: number;
  testsTotal: number;
  /** Server HMAC over the whole pack; approvals and releases refuse unsigned or altered packs. */
  signature?: string;
  draftHashes?: Record<string, string>;
}
