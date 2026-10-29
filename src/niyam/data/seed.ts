import type { Rule } from "../dsl/schema";

/**
 * SYNTHETIC starting state of the bank: its live rules (version 1, written against an older
 * synthetic Master Direction) and the internal credit policy they implement.
 */

export const OLD_MD = "MD-SYN-LEF-2025";

export const EXISTING_RULES: Rule[] = [
  {
    rule_id: "SYN-EXP-011",
    version: 1,
    status: "live",
    title: "Single counterparty exposure limit",
    applies_to: ["UCB", "NBFC-ML", "NBFC-UL"],
    when: { metric: "counterparty_exposure_pct_tier1", op: ">", value: 15, unit: "pct" },
    action: "block_new_exposure",
    severity: "high",
    source: {
      circular: OLD_MD,
      clause: "5.2",
      span: "exposure to a single counterparty exceeding 15 per cent of Tier 1 capital",
    },
  },
  {
    rule_id: "SYN-EXP-012",
    version: 1,
    status: "live",
    title: "Group exposure report",
    applies_to: ["UCB", "NBFC-ML", "NBFC-UL"],
    when: { metric: "group_exposure_pct_tier1", op: ">=", value: 15, unit: "pct" },
    unless: "board_approved",
    action: "flag_for_report",
    severity: "medium",
    source: {
      circular: OLD_MD,
      clause: "5.3",
      span: "group exposure equal to or exceeding 15 per cent of Tier 1 capital",
    },
  },
];

export interface PolicyClause {
  id: string;
  policy: string;
  section: string;
  text: string;
  /** Rules that implement this policy section. */
  implementedBy: string[];
  /** Numeric limit the section allows, if any, for conflict checks. */
  permits?: { metric: string; upTo: number; condition: string };
}

export const POLICIES: PolicyClause[] = [
  {
    id: "POL-CR-07-7.1",
    policy: "POL-CR-07 Credit Concentration Policy (SYNTHETIC)",
    section: "7.1",
    text: "The bank shall monitor exposure to single counterparties and groups daily against the limits set by the Reserve Bank.",
    implementedBy: ["SYN-EXP-011", "SYN-EXP-012"],
  },
  {
    id: "POL-CR-07-7.2",
    policy: "POL-CR-07 Credit Concentration Policy (SYNTHETIC)",
    section: "7.2",
    text: "The Board may approve an exposure to a group of connected counterparties of up to 15 per cent of Tier 1 capital, and such approved exposures shall not be reported as breaches.",
    implementedBy: ["SYN-EXP-012"],
    permits: { metric: "group_exposure_pct_tier1", upTo: 15, condition: "board_approved" },
  },
];
