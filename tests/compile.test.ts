import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "sql.js";
import { compileRule } from "@/niyam/dsl/compile";
import type { Operator, Rule } from "@/niyam/dsl/schema";
import type { LoanRow } from "@/niyam/data/loanBook";
import { createDb, runQuery } from "@/niyam/sql/engine";

const AS_OF = "2026-12-01";

function makeRule(metric: Rule["when"]["metric"], op: Operator, value: number, extra: Partial<Rule> = {}): Rule {
  return {
    rule_id: "SYN-TST-001",
    version: 1,
    status: "draft",
    title: "Compiler test rule",
    applies_to: ["UCB"],
    when: { metric, op, value, unit: "pct" },
    action: "raise_alert",
    severity: "high",
    source: { circular: "RBI-SYN-2026-017", clause: "4(b)", span: "exposure exceeding 12 per cent" },
    ...extra,
  };
}

let i = 0;
function loan(borrower: string, group: string, amt: number, boardApproved = 0): LoanRow {
  return {
    as_of: AS_OF,
    account_id: `ACC-${i++}`,
    borrower_id: borrower,
    group_id: group,
    sector: "Test",
    outstanding_amt: amt,
    board_approved: boardApproved,
  };
}

const opened: Database[] = [];
async function db(loans: LoanRow[], tier1 = 100) {
  const d = await createDb(loans, [{ as_of: AS_OF, tier1_amt: tier1 }]);
  opened.push(d);
  return d;
}
afterEach(() => {
  while (opened.length) opened.pop()!.close();
});

/** Expected outcome for (value relative to threshold) per operator: [below, on, above]. */
const EXPECT: Record<Operator, [boolean, boolean, boolean]> = {
  ">": [false, false, true],
  ">=": [false, true, true],
  "<": [true, false, false],
  "<=": [true, true, false],
  "==": [false, true, false],
};
const OPS = Object.keys(EXPECT) as Operator[];
const T = 12;
const POINTS: [string, number][] = [
  ["just below", T - 0.01],
  ["exactly on", T],
  ["just above", T + 0.01],
];

async function fires(rule: Rule, loans: LoanRow[], subject: string, tier1 = 100) {
  const rows = runQuery(await db(loans, tier1), compileRule(rule).sql);
  return rows.some((r) => r.subject_id === subject);
}

describe("compileRule: counterparty grain on sql.js", () => {
  for (const op of OPS) {
    POINTS.forEach(([label, v], k) => {
      it(`op ${op} at ${label} the ${T}% limit ${EXPECT[op][k] ? "fires" : "does not fire"}`, async () => {
        const loans = [loan("B1", "G1", v), loan("B2", "G2", 1)];
        expect(await fires(makeRule("counterparty_exposure_pct_tier1", op, T), loans, "B1")).toBe(EXPECT[op][k]);
      });
    });
  }

  it("aggregates multiple accounts of one borrower", async () => {
    const loans = [loan("B1", "G1", 7), loan("B1", "G1", 6), loan("B2", "G2", 1)];
    const rows = runQuery(await db(loans), compileRule(makeRule("counterparty_exposure_pct_tier1", ">", T)).sql);
    expect(rows).toEqual([{ as_of: AS_OF, subject_id: "B1", metric_value: 13 }]);
  });
});

describe("compileRule: group grain on sql.js", () => {
  for (const op of OPS) {
    POINTS.forEach(([label, v], k) => {
      it(`op ${op} at ${label} the ${T}% limit ${EXPECT[op][k] ? "fires" : "does not fire"}`, async () => {
        // Two borrowers in the same group; the sum (v - 5) + 5 is subject to float error.
        const loans = [loan("B1", "G1", Math.round((v - 5) * 100) / 100), loan("B2", "G1", 5), loan("B3", "G2", 1)];
        expect(await fires(makeRule("group_exposure_pct_tier1", op, T), loans, "G1")).toBe(EXPECT[op][k]);
      });
    });
  }

  it("unless: board_approved suppresses a board-approved group, and only then", async () => {
    const rule = makeRule("group_exposure_pct_tier1", ">", T, { unless: "board_approved" });
    const approved = [loan("B1", "G1", 10, 1), loan("B2", "G1", 5, 1)];
    expect(await fires(rule, approved, "G1")).toBe(false);
    const notApproved = [loan("B1", "G1", 10), loan("B2", "G1", 5)];
    expect(await fires(rule, notApproved, "G1")).toBe(true);
  });
});

describe("compileRule: bank grain (top-20 share) on sql.js", () => {
  const BT = 40;
  /** 20 large borrowers of `each` and 60 small borrowers of 1. */
  const book = (each: number) => [
    ...Array.from({ length: 20 }, (_, k) => loan(`TOP${k}`, `TOP${k}`, each)),
    ...Array.from({ length: 60 }, (_, k) => loan(`R${k}`, `R${k}`, 1)),
  ];
  // each=2 -> 40/100 = 40%; each=1.95 -> 39/99 = 39.39%; each=2.05 -> 41/101 = 40.59%
  const BANK_POINTS: [string, number][] = [
    ["below", 1.95],
    ["exactly on", 2],
    ["above", 2.05],
  ];

  for (const op of OPS) {
    BANK_POINTS.forEach(([label, each], k) => {
      it(`op ${op} ${label} the ${BT}% limit ${EXPECT[op][k] ? "fires" : "does not fire"}`, async () => {
        expect(await fires(makeRule("top20_share_pct_loans", op, BT), book(each), "BANK")).toBe(EXPECT[op][k]);
      });
    });
  }

  it("reports exactly 40.000000 for a book whose top 20 hold 40%", async () => {
    const rows = runQuery(await db(book(2)), compileRule(makeRule("top20_share_pct_loans", ">=", BT)).sql);
    expect(rows).toEqual([{ as_of: AS_OF, subject_id: "BANK", metric_value: 40 }]);
  });

  it("an empty loan book raises no alert", async () => {
    expect(runQuery(await db([]), compileRule(makeRule("top20_share_pct_loans", ">", BT)).sql)).toEqual([]);
  });
});

describe("compileRule: ROUND guard", () => {
  it("tier1 = 3 and exposure 0.36 evaluates to exactly 12 and equals 12", async () => {
    const loans = [loan("B1", "G1", 0.36)];
    const rows = runQuery(await db(loans, 3), compileRule(makeRule("counterparty_exposure_pct_tier1", "==", 12)).sql);
    expect(rows).toHaveLength(1);
    expect(rows[0].metric_value).toBe(12);
  });

  it("a float sum of 12.000000000000002 is rounded so '>' 12 does not fire and '==' 12 does", async () => {
    // 0.07 + 0.05 = 0.12000000000000001 in IEEE-754, so the unrounded percentage is above 12.
    const loans = [loan("B1", "G1", 0.07), loan("B2", "G1", 0.05)];
    const raw = runQuery(
      await db(loans, 1),
      "SELECT as_of, group_id AS subject_id, SUM(outstanding_amt) * 100.0 / 1 AS metric_value FROM loans GROUP BY as_of, group_id",
    );
    expect(raw[0].metric_value).toBeGreaterThan(12); // proves the fixture exercises the guard

    expect(await fires(makeRule("group_exposure_pct_tier1", ">", 12), loans, "G1", 1)).toBe(false);
    expect(await fires(makeRule("group_exposure_pct_tier1", "==", 12), loans, "G1", 1)).toBe(true);
  });

  it("tier1 of zero yields no alert instead of a division error", async () => {
    const loans = [loan("B1", "G1", 50)];
    expect(await fires(makeRule("counterparty_exposure_pct_tier1", ">", 12), loans, "B1", 0)).toBe(false);
  });
});
