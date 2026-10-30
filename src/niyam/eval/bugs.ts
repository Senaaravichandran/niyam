import { CIRCULAR_REF } from "../data/circular";
import type { Rule } from "../dsl/schema";

/**
 * Seeded-bug suite for the Validator (SYNTHETIC).
 *
 * Each draft is the correct SYN-EXP-012 v2 (group exposure above 12 per cent of Tier 1, from
 * RBI-SYN-2026-017 para 4(b)) with exactly one deliberate mistake, the kind an Author agent or a
 * hurried analyst could make. The correct rule is included as a control and must not be flagged.
 */

export const CORRECT_SPAN = "aggregate exposure exceeding 12 per cent of Tier 1 capital";

export const CORRECT_RULE: Rule = {
  rule_id: "SYN-EXP-012",
  version: 2,
  status: "draft",
  title: "Group exposure report",
  applies_to: ["UCB", "NBFC-ML", "NBFC-UL"],
  when: { metric: "group_exposure_pct_tier1", op: ">", value: 12, unit: "pct" },
  action: "flag_for_report",
  severity: "medium",
  source: {
    circular: CIRCULAR_REF,
    clause: "4(b)",
    obligation: "OBL-017-4b",
    span: CORRECT_SPAN,
  },
};

export interface SeededBug {
  id: string;
  label: string;
  /** What the mistake would do in production. */
  consequence: string;
  rule: Rule;
  control?: boolean;
}

function mutate(fn: (r: Rule) => void): Rule {
  const r = structuredClone(CORRECT_RULE);
  fn(r);
  return r;
}

export const CONTROL: SeededBug = {
  id: "CONTROL",
  label: "Correct rule (control)",
  consequence: "None: this is the rule the clause requires",
  rule: structuredClone(CORRECT_RULE),
  control: true,
};

export const SEEDED_BUGS: SeededBug[] = [
  {
    id: "BUG-01",
    label: 'op ">=" instead of ">"',
    consequence: "Fires at exactly 12.00%, which 'exceeding' does not breach",
    rule: mutate((r) => (r.when.op = ">=")),
  },
  {
    id: "BUG-02",
    label: "threshold 1.2 (decimal slip)",
    consequence: "Flags almost every group",
    rule: mutate((r) => (r.when.value = 1.2)),
  },
  {
    id: "BUG-03",
    label: "threshold 120 (decimal slip)",
    consequence: "Never fires",
    rule: mutate((r) => (r.when.value = 120)),
  },
  {
    id: "BUG-04",
    label: "metric counterparty instead of group",
    consequence: "Measures single borrowers, misses connected groups",
    rule: mutate((r) => (r.when.metric = "counterparty_exposure_pct_tier1")),
  },
  {
    id: "BUG-05",
    label: "scope missing UCB",
    consequence: "Rule is silent for the bank it is deployed in",
    rule: mutate((r) => (r.applies_to = ["NBFC-ML", "NBFC-UL"])),
  },
  {
    id: "BUG-06",
    label: "Board exception left in (unless: board_approved)",
    consequence: "Board-approved groups escape, which para 5 forbids",
    rule: mutate((r) => (r.unless = "board_approved")),
  },
  {
    id: "BUG-07",
    label: "source span changed",
    consequence: "Audit trail cites words the circular does not contain",
    rule: mutate((r) => (r.source.span = "aggregate exposure equal to or exceeding 12 per cent of Tier 1 capital")),
  },
  {
    id: "BUG-08",
    label: 'op "<" instead of ">"',
    consequence: "Fires on compliant groups, silent on breaches",
    rule: mutate((r) => (r.when.op = "<")),
  },
  {
    id: "BUG-09",
    label: "threshold 13 instead of 12",
    consequence: "Misses groups between 12% and 13%",
    rule: mutate((r) => (r.when.value = 13)),
  },
  {
    id: "BUG-10",
    label: 'op "==" instead of ">"',
    consequence: "Fires only at exactly 12.00%",
    rule: mutate((r) => (r.when.op = "==")),
  },
];
