import type { EntityType } from "./data/bankProfile";
import type { Operator, Rule } from "./dsl/schema";

export type Applicability = "applies" | "not_applicable" | "informational";

export interface Clause {
  id: string;
  number: string;
  heading?: string;
  text: string;
  applicability: Applicability;
  reason: string;
  scope: EntityType[];
}

export type Modality = "MUST" | "MUST_NOT" | "MAY";

export interface Obligation {
  id: string;
  clauseId: string;
  clauseNumber: string;
  kind: "quantitative" | "procedural";
  modality: Modality;
  actor: string;
  metric?: string;
  /** The operator under which the rule must fire (the violation condition). */
  operator?: Operator;
  comparatorPhrase?: string;
  threshold?: number;
  unit?: "pct";
  action: string;
  effectiveFrom: string;
  scope: EntityType[];
  /** Exact substring of the clause text. Verified, never trusted. */
  span: string;
  spanStart: number;
  spanEnd: number;
  extractedBy: "rule-based" | "llm";
}

export interface RejectedObligation {
  clauseNumber: string;
  span: string;
  reason: string;
}

export interface MappingResult {
  modify: { ruleId: string; obligationId: string; change: string }[];
  gaps: { obligationId: string; proposedRuleId: string; reason: string }[];
  conflicts: {
    policyId: string;
    policySection: string;
    obligationId: string;
    detail: string;
    resolution: string;
  }[];
  manualControls: { obligationId: string; control: string }[];
}

export interface RuleDraft {
  rule: Rule;
  yaml: string;
  previousYaml?: string;
  obligationId: string;
  kind: "modify" | "new";
  commit?: string;
}

export interface TestCase {
  id: string;
  ruleId: string;
  name: string;
  /** What the test feeds in, in words. */
  given: string;
  expectFire: boolean;
  /** Fixture: daily rows for the compiled SQL to run on. */
  fixture: {
    entity: EntityType;
    tier1: number;
    loans: { borrower_id: string; group_id: string; amt: number; board_approved?: number }[];
  };
}

export interface TestResult {
  id: string;
  ruleId: string;
  name: string;
  given: string;
  expectFire: boolean;
  fired: boolean;
  pass: boolean;
}

export interface Objection {
  id: string;
  ruleId: string;
  code: string;
  clause: string;
  span: string;
  expected: string;
  found: string;
  evidence: string;
  failingTests: string[];
}

export type StepStatus = "running" | "done" | "warn" | "error" | "blocked";
