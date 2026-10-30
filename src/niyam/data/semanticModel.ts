/**
 * Bank Semantic Model (SYNTHETIC).
 * Regulators write in business language; rules are written against these business metrics and
 * compiled to the bank's physical columns. Onboarding another bank means changing this mapping,
 * not the rules.
 */

export type Grain = "counterparty" | "group" | "bank";

export interface MetricDef {
  id: string;
  label: string;
  unit: "pct";
  grain: Grain;
  /** Business definition, shown to reviewers. */
  definition: string;
  /** Physical definition, shown to reviewers. */
  physical: string;
  /** Phrases that, inside a clause, identify this metric. */
  phrases: string[];
}

export const TABLES = {
  loans: {
    columns: {
      as_of: "DATE",
      account_id: "TEXT",
      borrower_id: "TEXT",
      group_id: "TEXT",
      sector: "TEXT",
      outstanding_amt: "DOUBLE (INR crore)",
    },
  },
  capital: {
    columns: { as_of: "DATE", tier1_amt: "DOUBLE (INR crore)" },
  },
} as const;

export const METRICS: MetricDef[] = [
  {
    id: "counterparty_exposure_pct_tier1",
    label: "Single counterparty exposure, % of Tier 1",
    unit: "pct",
    grain: "counterparty",
    definition: "Exposure to one counterparty as a share of Tier 1 capital",
    physical: "SUM(loans.outstanding_amt) BY borrower_id / capital.tier1_amt * 100",
    phrases: ["single counterparty", "single borrower", "any one borrower", "any single borrower", "a single party", "individual borrower"],
  },
  {
    id: "group_exposure_pct_tier1",
    label: "Group exposure, % of Tier 1",
    unit: "pct",
    grain: "group",
    definition: "Aggregate exposure to a group of connected counterparties as a share of Tier 1 capital",
    physical: "SUM(loans.outstanding_amt) BY group_id / capital.tier1_amt * 100",
    phrases: ["group of connected counterparties", "group of connected borrowers", "connected counterparties", "borrower group", "group exposure"],
  },
  {
    id: "top20_share_pct_loans",
    label: "Top 20 borrowers, % of total loans",
    unit: "pct",
    grain: "bank",
    definition: "Aggregate exposure to the twenty largest borrowers as a share of total loans and advances",
    physical: "SUM(top 20 borrower totals) / SUM(loans.outstanding_amt) * 100",
    phrases: ["twenty largest borrowers", "top twenty borrowers", "top 20 borrowers", "20 largest borrowers"],
  },
];

export function metricById(id: string): MetricDef | undefined {
  return METRICS.find((m) => m.id === id);
}

export function metricForText(text: string): MetricDef | undefined {
  const t = text.toLowerCase();
  return METRICS.find((m) => m.phrases.some((p) => t.includes(p)));
}
