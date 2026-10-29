/** SYNTHETIC profile of the bank the demo runs for. */

export type EntityType = "UCB" | "NBFC-ML" | "NBFC-UL" | "SCB";

export interface BankProfile {
  id: string;
  name: string;
  entityType: EntityType;
  tier: string;
  state: string;
  tier1CapitalCr: number;
  products: string[];
  synthetic: true;
}

export const BANK_PROFILE: BankProfile = {
  id: "BANK-SYN-UCB-07",
  name: "Demo Urban Co-operative Bank (SYNTHETIC)",
  entityType: "UCB",
  tier: "Tier 3 UCB",
  state: "Puducherry",
  tier1CapitalCr: 412,
  products: ["Term loans", "Working capital", "Gold loans", "Housing loans"],
  synthetic: true,
};

export const ENTITY_LABEL: Record<EntityType, string> = {
  UCB: "Primary (Urban) Co-operative Bank",
  "NBFC-ML": "NBFC, Middle Layer",
  "NBFC-UL": "NBFC, Upper Layer",
  SCB: "Scheduled Commercial Bank",
};
