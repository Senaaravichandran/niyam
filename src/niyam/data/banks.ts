import type { Rule } from "../dsl/schema";
import type { BankProfile } from "./bankProfile";
import { CIRCULAR } from "./circular";
import { DEFAULT_SHAPE, LOAN_BOOK_SEED, type BookShape } from "./loanBook";
import { EXISTING_RULES, OLD_MD, POLICIES, type PolicyClause } from "./seed";

/**
 * Four SYNTHETIC banks. Each has its own licence type, live rules, internal policy, loan book,
 * the circular it has just received (also published as a PDF in /bank-rules), and its own
 * operations site. Names, numbers and circulars are fictional.
 */

export type BankKey = "abc" | "def" | "ghi" | "jkl";

export interface BankDef {
  key: BankKey;
  /** Short display name. */
  short: string;
  kind: string;
  profile: BankProfile;
  rules: Rule[];
  policies: PolicyClause[];
  book: { seed: number; shape: BookShape };
  circular: { ref: string; title: string; pdf: string; text: string };
  /** Production host of the bank's operations site. */
  host: string;
  /** Brand colour for the bank's own site. */
  brand: string;
}

const rule = (
  id: "SYN-EXP-011" | "SYN-EXP-012",
  appliesTo: Rule["applies_to"],
  op: Rule["when"]["op"],
  value: number,
  clause: string,
  span: string,
  unless?: "board_approved",
): Rule => ({
  rule_id: id,
  version: 1,
  status: "live",
  title: id === "SYN-EXP-011" ? "Single counterparty exposure limit" : "Group exposure report",
  applies_to: appliesTo,
  when: { metric: id === "SYN-EXP-011" ? "counterparty_exposure_pct_tier1" : "group_exposure_pct_tier1", op, value, unit: "pct" },
  ...(unless ? { unless } : {}),
  action: id === "SYN-EXP-011" ? "block_new_exposure" : "flag_for_report",
  severity: id === "SYN-EXP-011" ? "high" : "medium",
  source: { circular: OLD_MD, clause, span },
});

const HEADER = (ref: string, dept: string, date: string, to: string, title: string) => `${ref}
${dept}                                ${date}

${to}

Madam / Sir,

${title}

THIS IS A SYNTHETIC CIRCULAR PREPARED FOR A DEMONSTRATION. IT IS NOT ISSUED BY THE RESERVE BANK OF INDIA.
`;

const FOOTER = `
Yours faithfully,

(Synthetic Signatory)
Chief General Manager (SYNTHETIC)`;

const ABC_TEXT = `${HEADER(
  "RBI/2026-27/SYN-031",
  "DOR.CRE.REC.SYN-31/21.01.003/2026-27",
  "October 6, 2026",
  "All Scheduled Commercial Banks (excluding Regional Rural Banks)",
  "Large Exposures Framework: Revised Limits for Private Sector Banks",
)}
1. Short title and commencement. These directions shall be called the Large Exposures Framework (Amendment) Directions, 2026 and shall come into force on January 1, 2027.

2. Applicability. These directions shall apply to all Scheduled Commercial Banks in the private sector.

3. Definitions. Exposure shall mean the sum of funded and non-funded credit facilities, and Tier 1 capital shall be reckoned as on March 31 of the previous financial year.

4. Exposure limits.
(a) A bank shall not take an exposure to a single counterparty exceeding 18 per cent of its Tier 1 capital.
(b) A bank shall flag for report any group of connected counterparties with an aggregate exposure exceeding 22 per cent of Tier 1 capital.
(c) The aggregate exposure of a bank to its twenty largest borrowers shall not exceed 52 per cent of its total loans and advances.

5. Board oversight. Any exposure flagged under paragraph 4 shall be placed before the Board of Directors within 30 days, and no internal policy shall permit a group exposure above the limit in paragraph 4(b), including with the approval of the Board.

6. Repeal. Paragraphs 5.2 and 5.3 of MD-SYN-LEF-2025 stand withdrawn for private sector banks from the date these directions come into force.
${FOOTER}`;

const DEF_TEXT = `${HEADER(
  "RBI/2026-27/SYN-032",
  "DOR.CRE.REC.SYN-32/21.01.003/2026-27",
  "October 13, 2026",
  "All Public Sector Banks",
  "Group Exposure Monitoring for Public Sector Banks",
)}
1. Short title and commencement. These directions shall be called the Group Exposure (Public Sector Banks) Directions, 2026 and shall come into force on January 1, 2027.

2. Applicability. These directions shall apply to all Scheduled Commercial Banks in the public sector.

3. Exposure limits.
(a) A bank shall not take an exposure to a single counterparty exceeding 20 per cent of its Tier 1 capital.
(b) A bank shall flag for report any group of connected counterparties with an aggregate exposure of 20 per cent or more of its Tier 1 capital.
(c) The aggregate exposure of a bank to its twenty largest borrowers shall not exceed 50 per cent of its total loans and advances.

4. Reporting. Any exposure flagged under paragraph 3 shall be placed before the Board of Directors within 30 days.

5. Saving. Paragraph 5.2 of MD-SYN-LEF-2025 continues to apply; paragraph 5.3 stands withdrawn.
${FOOTER}`;

const JKL_TEXT = `${HEADER(
  "RBI/2026-27/SYN-044",
  "DoR.FIN.REC.SYN-44/03.10.119/2026-27",
  "October 20, 2026",
  "All Non-Banking Financial Companies in the Middle Layer and the Upper Layer",
  "Concentration and Capital Norms for NBFCs",
)}
1. Applicability. These directions shall apply to Non-Banking Financial Companies in the Middle Layer and the Upper Layer.

2. Capital adequacy. An NBFC shall maintain a capital ratio of not less than 15 per cent of its aggregate risk weighted assets.

3. Concentration.
(a) An NBFC shall not take an exposure to a single counterparty exceeding 20 per cent of its Tier 1 capital.
(b) The aggregate exposure of an NBFC to its twenty largest borrowers shall not exceed 61 per cent of its total loans and advances.

4. Reporting. Any exposure flagged under paragraph 3 shall be placed before the Board of Directors within 30 days.

5. Commencement. These directions shall come into force on January 1, 2027.
${FOOTER}`;

export const BANKS: BankDef[] = [
  {
    key: "abc",
    short: "ABC Bank",
    kind: "Private sector bank",
    profile: {
      id: "BANK-SYN-ABC",
      name: "ABC Bank Ltd (SYNTHETIC)",
      entityType: "SCB",
      tier: "Private sector Scheduled Commercial Bank",
      state: "Maharashtra",
      tier1CapitalCr: 18_400,
      products: ["Corporate loans", "Working capital", "Retail loans", "Cards"],
      synthetic: true,
    },
    rules: [
      rule("SYN-EXP-011", ["SCB"], ">", 20, "5.2", "exposure to a single counterparty exceeding 20 per cent of Tier 1 capital"),
      rule("SYN-EXP-012", ["SCB"], ">=", 25, "5.3", "group exposure equal to or exceeding 25 per cent of Tier 1 capital", "board_approved"),
    ],
    policies: [
      {
        id: "ABC-LEP-04-3.1",
        policy: "ABC-LEP-04 Large Exposure Policy (SYNTHETIC)",
        section: "3.1",
        text: "Treasury and Credit Risk shall monitor single and group exposures every business day against the regulatory limits.",
        implementedBy: ["SYN-EXP-011", "SYN-EXP-012"],
      },
      {
        id: "ABC-LEP-04-3.2",
        policy: "ABC-LEP-04 Large Exposure Policy (SYNTHETIC)",
        section: "3.2",
        text: "The Board may approve an exposure to a group of connected counterparties of up to 25 per cent of Tier 1 capital; approved exposures are not reported as breaches.",
        implementedBy: ["SYN-EXP-012"],
        permits: { metric: "group_exposure_pct_tier1", upTo: 25, condition: "board_approved" },
      },
    ],
    book: { seed: 31_001, shape: { tier1: 18_400, groupNew: 22, groupOld: 25 } },
    circular: { ref: "RBI-SYN-2026-031", title: "Large Exposures Framework: Revised Limits for Private Sector Banks (SYNTHETIC)", pdf: "/bank-rules/ABC_Bank_circular.pdf", text: ABC_TEXT },
    host: "abc-bank-niyam.vercel.app",
    brand: "#7a1f2b",
  },
  {
    key: "def",
    short: "DEF Bank",
    kind: "Public sector bank",
    profile: {
      id: "BANK-SYN-DEF",
      name: "DEF Bank (SYNTHETIC)",
      entityType: "SCB",
      tier: "Public sector Scheduled Commercial Bank",
      state: "Karnataka",
      tier1CapitalCr: 31_200,
      products: ["Corporate loans", "Agriculture", "MSME", "Housing loans"],
      synthetic: true,
    },
    rules: [
      rule("SYN-EXP-011", ["SCB"], ">", 20, "5.2", "exposure to a single counterparty exceeding 20 per cent of Tier 1 capital"),
      rule("SYN-EXP-012", ["SCB"], ">", 25, "5.3", "group exposure exceeding 25 per cent of Tier 1 capital"),
    ],
    policies: [
      {
        id: "DEF-CRM-02-4.1",
        policy: "DEF-CRM-02 Credit Risk Management Policy (SYNTHETIC)",
        section: "4.1",
        text: "The Credit Monitoring Department shall track single and group exposures daily and report breaches to the Risk Management Committee.",
        implementedBy: ["SYN-EXP-011", "SYN-EXP-012"],
      },
    ],
    book: { seed: 31_002, shape: { tier1: 31_200, groupNew: 20, groupOld: 25 } },
    circular: { ref: "RBI-SYN-2026-032", title: "Group Exposure Monitoring for Public Sector Banks (SYNTHETIC)", pdf: "/bank-rules/DEF_Bank_circular.pdf", text: DEF_TEXT },
    host: "def-bank-niyam.vercel.app",
    brand: "#0f4c81",
  },
  {
    key: "ghi",
    short: "GHI Co-operative Bank",
    kind: "Urban co-operative bank",
    profile: {
      id: "BANK-SYN-GHI",
      name: "GHI Urban Co-operative Bank (SYNTHETIC)",
      entityType: "UCB",
      tier: "Tier 3 UCB",
      state: "Puducherry",
      tier1CapitalCr: 412,
      products: ["Term loans", "Working capital", "Gold loans", "Housing loans"],
      synthetic: true,
    },
    rules: EXISTING_RULES,
    policies: POLICIES,
    book: { seed: LOAN_BOOK_SEED, shape: DEFAULT_SHAPE },
    circular: { ref: CIRCULAR.ref, title: CIRCULAR.title, pdf: "/bank-rules/GHI_Cooperative_Bank_circular.pdf", text: CIRCULAR.text },
    host: "ghi-bank-niyam.vercel.app",
    brand: "#1f6f4a",
  },
  {
    key: "jkl",
    short: "JKL Finance",
    kind: "NBFC, middle layer",
    profile: {
      id: "BANK-SYN-JKL",
      name: "JKL Finance Ltd (SYNTHETIC)",
      entityType: "NBFC-ML",
      tier: "NBFC, Middle Layer",
      state: "Tamil Nadu",
      tier1CapitalCr: 2_150,
      products: ["Vehicle loans", "MSME loans", "Gold loans"],
      synthetic: true,
    },
    rules: [
      rule("SYN-EXP-011", ["NBFC-ML", "NBFC-UL"], ">", 25, "5.2", "exposure to a single counterparty exceeding 25 per cent of Tier 1 capital"),
      rule("SYN-EXP-012", ["NBFC-ML", "NBFC-UL"], ">", 40, "5.3", "group exposure exceeding 40 per cent of Tier 1 capital"),
    ],
    policies: [
      {
        id: "JKL-RMP-01-6.1",
        policy: "JKL-RMP-01 Risk Management Policy (SYNTHETIC)",
        section: "6.1",
        text: "The Risk team shall review borrower and group concentration every day and escalate breaches to the Credit Committee.",
        implementedBy: ["SYN-EXP-011", "SYN-EXP-012"],
      },
    ],
    book: { seed: 31_004, shape: { tier1: 2_150, groupNew: 30, groupOld: 35 } },
    circular: { ref: "RBI-SYN-2026-044", title: "Concentration and Capital Norms for NBFCs (SYNTHETIC)", pdf: "/bank-rules/JKL_Finance_circular.pdf", text: JKL_TEXT },
    host: "jkl-finance-niyam.vercel.app",
    brand: "#8a5a00",
  },
];

/** The bank the console and tests use when none is chosen: the original demo bank. */
export const DEFAULT_BANK: BankKey = "ghi";

export function bankByKey(key?: string | null): BankDef {
  return BANKS.find((b) => b.key === key) ?? BANKS.find((b) => b.key === DEFAULT_BANK)!;
}

export function bankByHost(host?: string | null): BankDef | undefined {
  const h = (host ?? "").toLowerCase().split(":")[0];
  return BANKS.find((b) => b.host === h);
}

/** Public URL of a bank's operations site: its own subdomain in production, a path elsewhere. */
export function bankSiteUrl(b: BankDef, origin?: string): string {
  if (origin && /localhost|127\.0\.0\.1/.test(origin)) return `${origin}/bank/${b.key}`;
  return `https://${b.host}`;
}
