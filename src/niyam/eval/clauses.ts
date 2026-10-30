import type { EntityType } from "../data/bankProfile";
import type { Operator } from "../dsl/schema";

/**
 * Labelled evaluation set for the rule-based Extractor (SYNTHETIC).
 *
 * Thirty clauses written in RBI house style. None of them is real regulation. Gold labels were
 * written by hand before the extractor was run against them, and the extractor was not changed to
 * fit them: the point is to measure it honestly, including where it is wrong.
 *
 * Label conventions
 * - `operator` is the condition under which a rule must FIRE (the violation), matching the
 *   Obligation type: "shall not exceed 40" fires on ">", "at least 100" fires on "<",
 *   "less than 25" fires on ">=".
 * - `metric` is a semantic-model metric id, or null when the clause measures something the
 *   semantic model does not define (capital ratios, rupee amounts). A null gold metric means the
 *   correct answer is "no metric".
 * - `threshold` is the number in the clause's own unit (`unit`, default "pct").
 * - `trap` records, in advance, why a clause is expected to be hard for a pattern-based reader.
 */

export type GoldKind = "quantitative" | "procedural" | "none";
export type GoldUnit = "pct" | "inr_lakh" | "inr_crore";

export interface Gold {
  kind: GoldKind;
  metric?: string | null;
  operator?: Operator;
  threshold?: number;
  unit?: GoldUnit;
}

export interface EvalClause {
  id: string;
  text: string;
  scope: EntityType[];
  gold: Gold;
  trap?: string;
  note?: string;
}

const ALL: EntityType[] = ["UCB", "NBFC-ML", "NBFC-UL"];
const CP = "counterparty_exposure_pct_tier1";
const GRP = "group_exposure_pct_tier1";
const TOP = "top20_share_pct_loans";

export const EVAL_CLAUSES: EvalClause[] = [
  /* ---------- plain comparators, the three metrics ---------- */
  {
    id: "EV-01",
    text: "A regulated entity shall not take an exposure to a single counterparty exceeding 10 per cent of its Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 10 },
  },
  {
    id: "EV-02",
    text: "The aggregate exposure of a regulated entity to its twenty largest borrowers shall not exceed 40 per cent of its total loans and advances.",
    scope: ALL,
    gold: { kind: "quantitative", metric: TOP, operator: ">", threshold: 40 },
  },
  {
    id: "EV-03",
    text: "A regulated entity shall ensure that its exposure to any group of connected counterparties is not exceeding 25 per cent of its Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: GRP, operator: ">", threshold: 25 },
  },
  {
    id: "EV-04",
    text: "A regulated entity shall report any exposure to a single counterparty in excess of 15 per cent of Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 15 },
  },
  {
    id: "EV-05",
    text: "No regulated entity shall have an exposure to a group of connected counterparties of more than 20 per cent of its Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: GRP, operator: ">", threshold: 20 },
  },
  {
    id: "EV-06",
    text: "A regulated entity shall maintain a liquidity coverage ratio of at least 100 per cent of its total net cash outflows.",
    scope: ["NBFC-UL"],
    gold: { kind: "quantitative", metric: null, operator: "<", threshold: 100 },
    note: "Floor on a metric outside the semantic model; correct metric answer is none.",
  },
  {
    id: "EV-07",
    text: "The Common Equity Tier 1 ratio of a regulated entity shall be not less than 5.5 per cent of its risk weighted assets.",
    scope: ["UCB"],
    gold: { kind: "quantitative", metric: null, operator: "<", threshold: 5.5 },
    note: "Floor on a capital ratio the semantic model does not define.",
  },
  {
    id: "EV-08",
    text: "The exposure of a regulated entity to a single counterparty shall be less than 25 per cent of its Tier 1 capital at all times.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">=", threshold: 25 },
    note: "Strict ceiling: equality is already a breach.",
  },
  {
    id: "EV-09",
    text: "A regulated entity must keep its group exposure below 15 per cent of Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: GRP, operator: ">=", threshold: 15 },
  },
  {
    id: "EV-10",
    text: "Credit concentration in the twenty largest borrowers shall not exceed 35 per cent of total loans and advances of the regulated entity.",
    scope: ALL,
    gold: { kind: "quantitative", metric: TOP, operator: ">", threshold: 35 },
  },
  {
    id: "EV-14",
    text: "A regulated entity shall flag for report any group of connected counterparties with an aggregate exposure exceeding 12 per cent of Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: GRP, operator: ">", threshold: 12 },
    note: "The live clause 4(b) of RBI-SYN-2026-017.",
  },

  /* ---------- the same metrics in other words ---------- */
  {
    id: "EV-11",
    text: "A regulated entity shall not take an exposure to any one borrower exceeding 15 per cent of its Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 15 },
    trap: "Single-counterparty metric phrased as 'any one borrower'.",
  },
  {
    id: "EV-12",
    text: "Exposure to a borrower group, taken together, shall not exceed 25 per cent of Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: GRP, operator: ">", threshold: 25 },
    trap: "Group metric phrased as 'borrower group'.",
  },
  {
    id: "EV-13",
    text: "The combined exposure to the top twenty borrowers shall not exceed 30 per cent of total loans and advances.",
    scope: ALL,
    gold: { kind: "quantitative", metric: TOP, operator: ">", threshold: 30 },
    trap: "Concentration metric phrased as 'top twenty borrowers'.",
  },

  /* ---------- numbers written differently ---------- */
  {
    id: "EV-15",
    text: "Exposure to a single counterparty shall be permitted up to and including 15 per cent of Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 15 },
    trap: "'up to and including' is a ceiling with no listed comparator phrase.",
  },
  {
    id: "EV-16",
    text: "A regulated entity shall not take an exposure to a single counterparty exceeding 15 percent of its Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 15 },
    trap: "'percent' as one word.",
  },
  {
    id: "EV-17",
    text: "A regulated entity shall not take an exposure to a single counterparty exceeding 15% of its Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 15 },
    trap: "Percent sign instead of 'per cent'.",
  },
  {
    id: "EV-18",
    text: "A regulated entity shall not take an exposure to a single counterparty exceeding fifteen per cent of its Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 15 },
    trap: "Threshold in words.",
  },
  {
    id: "EV-19",
    text: "A regulated entity shall not sanction an unsecured loan to a single counterparty exceeding ₹25 lakh.",
    scope: ["UCB"],
    gold: { kind: "quantitative", metric: null, operator: ">", threshold: 25, unit: "inr_lakh" },
    trap: "Absolute rupee limit in lakh; no percentage metric applies.",
  },
  {
    id: "EV-20",
    text: "A regulated entity shall not take an exposure to a group of connected counterparties in excess of ₹500 crore.",
    scope: ["NBFC-UL"],
    gold: { kind: "quantitative", metric: null, operator: ">", threshold: 500, unit: "inr_crore" },
    trap: "Absolute rupee limit in crore; the group metric in the model is a percentage, so metric is none.",
  },
  {
    id: "EV-21",
    text: "A regulated entity shall report any exposure to a single counterparty exceeding the higher of 10 per cent of its Tier 1 capital or ₹25 lakh.",
    scope: ["UCB"],
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 10 },
    trap: "'the higher of' two limits; the DSL cannot express the rupee leg.",
    note: "Gold records the percentage leg only. A faithful rule needs a DSL extension.",
  },

  /* ---------- comparator traps ---------- */
  {
    id: "EV-22",
    text: "No regulated entity shall fail to ensure that its exposure to a single counterparty does not exceed 15 per cent of its Tier 1 capital.",
    scope: ALL,
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 15 },
    trap: "Double negative, and 'does not exceed' rather than 'shall not exceed'.",
  },
  {
    id: "EV-23",
    text: "A regulated entity with at least 50 branches shall not take an exposure to a single counterparty exceeding 10 per cent of its Tier 1 capital.",
    scope: ["UCB"],
    gold: { kind: "quantitative", metric: CP, operator: ">", threshold: 10 },
    trap: "'at least' qualifies the entity, not the limit.",
  },
  {
    id: "EV-24",
    text: "Exposure to the twenty largest borrowers equal to or more than 30 per cent of total loans and advances shall be reported to the Board.",
    scope: ALL,
    gold: { kind: "quantitative", metric: TOP, operator: ">=", threshold: 30 },
    trap: "'equal to or more than' makes equality a breach.",
  },

  /* ---------- procedural ---------- */
  {
    id: "EV-25",
    text: "Any exposure flagged under paragraph 4 shall be placed before the Board of Directors within 30 days.",
    scope: ALL,
    gold: { kind: "procedural" },
  },
  {
    id: "EV-26",
    text: "A regulated entity shall submit a return on large exposures to the Reserve Bank within 15 days from the end of each quarter.",
    scope: ALL,
    gold: { kind: "procedural" },
    trap: "A reporting deadline worded differently from the Board deadline.",
  },
  {
    id: "EV-27",
    text: "No internal policy shall permit a group exposure above the limit in paragraph 4(b), including with the approval of the Board.",
    scope: ALL,
    gold: { kind: "procedural" },
  },
  {
    id: "EV-28",
    text: "The Board of Directors shall review the large exposures policy at least once every year.",
    scope: ALL,
    gold: { kind: "procedural" },
    trap: "'at least' governs a review frequency, not a metric.",
  },

  /* ---------- not obligations ---------- */
  {
    id: "EV-29",
    text: "For the purpose of these directions, exposure shall mean the sum of funded and non-funded credit facilities, and Tier 1 capital shall be reckoned as on March 31 of the previous financial year.",
    scope: ALL,
    gold: { kind: "none" },
  },
  {
    id: "EV-30",
    text: "For the purpose of these directions, a large exposure means an exposure to a single counterparty exceeding 10 per cent of Tier 1 capital.",
    scope: ALL,
    gold: { kind: "none" },
    trap: "A definition that contains a comparator and a percentage.",
  },
];
