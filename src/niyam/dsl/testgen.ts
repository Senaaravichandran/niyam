import { metricById } from "../data/semanticModel";
import type { Database } from "sql.js";
import { createDb, runQuery } from "../sql/engine";
import { compileRule } from "./compile";
import type { Rule } from "./schema";
import type { Obligation, TestCase, TestResult } from "../types";

/**
 * Tests are generated from the OBLIGATION (the regulation), never from the draft rule.
 * A draft that misreads the clause therefore fails its own tests.
 */

function holds(op: string, v: number, t: number) {
  switch (op) {
    case ">":
      return v > t;
    case ">=":
      return v >= t;
    case "<":
      return v < t;
    case "<=":
      return v <= t;
    default:
      return v === t;
  }
}

const r2 = (n: number) => Math.round(n * 10000) / 10000;

function fixtureFor(metric: string, value: number, boardApproved = 0): TestCase["fixture"] {
  const grain = metricById(metric)?.grain;
  if (grain === "counterparty") {
    return {
      entity: "UCB",
      tier1: 100,
      loans: [
        { borrower_id: "T-B1", group_id: "T-G1", amt: r2(value) },
        { borrower_id: "T-B2", group_id: "T-G2", amt: 1 },
      ],
    };
  }
  if (grain === "group") {
    return {
      entity: "UCB",
      tier1: 100,
      loans: [
        { borrower_id: "T-B1", group_id: "T-G1", amt: r2(value - 5), board_approved: boardApproved },
        { borrower_id: "T-B2", group_id: "T-G1", amt: 5, board_approved: boardApproved },
      ],
    };
  }
  // Bank-level concentration: 20 equal large borrowers holding `value`% of a 100-crore book,
  // the rest spread over borrowers that are each smaller than any of the 20.
  const each = value / 20;
  const restTotal = 100 - value;
  const restCount = Math.ceil(restTotal / (each * 0.9)) + 1;
  const loans = [];
  for (let i = 0; i < 20; i++) loans.push({ borrower_id: `T-TOP${i}`, group_id: `T-TOP${i}`, amt: each });
  for (let i = 0; i < restCount; i++)
    loans.push({ borrower_id: `T-R${i}`, group_id: `T-R${i}`, amt: restTotal / restCount });
  return { entity: "UCB", tier1: 100, loans };
}

export function generateTests(
  ruleId: string,
  ob: Obligation,
  opts: { boardOverrideTest?: boolean } = {},
): TestCase[] {
  if (ob.kind !== "quantitative" || !ob.metric || ob.threshold === undefined || !ob.operator) return [];
  const t = ob.threshold;
  const op = ob.operator;
  const grain = metricById(ob.metric)?.grain;
  const cases: TestCase[] = [];
  const add = (name: string, given: string, value: number, expectFire: boolean, fx?: TestCase["fixture"]) =>
    cases.push({
      id: `${ruleId}-T${cases.length + 1}`,
      ruleId,
      name,
      given,
      expectFire,
      fixture: fx ?? fixtureFor(ob.metric!, value),
    });

  add("Just below the limit", `${(t - 0.01).toFixed(2)}%`, t - 0.01, holds(op, t - 0.01, t));
  add("Exactly on the limit", `${t.toFixed(2)}%`, t, holds(op, t, t));
  add("Just above the limit", `${(t + 0.01).toFixed(2)}%`, t + 0.01, holds(op, t + 0.01, t));
  const outOfScope = fixtureFor(ob.metric, t + 3);
  outOfScope.entity = "SCB";
  add("Out of scope entity", `Scheduled Commercial Bank at ${(t + 3).toFixed(2)}%`, t + 3, false, outOfScope);

  if (opts.boardOverrideTest && grain === "group") {
    add(
      "Board approval does not suppress",
      `Board-approved group at ${(t + 2).toFixed(2)}%`,
      t + 2,
      true,
      fixtureFor(ob.metric, t + 2, 1),
    );
  }
  if (grain === "bank") {
    add("Empty loan book", "No loans on the day", 0, false, { entity: "UCB", tier1: 100, loans: [] });
  }
  return cases;
}

async function fixtureDb(fx: TestCase["fixture"]): Promise<Database> {
  const asOf = "2026-12-01";
  return createDb(
    fx.loans.map((l, i) => ({
      as_of: asOf,
      account_id: `T-ACC-${i}`,
      borrower_id: l.borrower_id,
      group_id: l.group_id,
      sector: "Test",
      outstanding_amt: l.amt,
      board_approved: l.board_approved ?? 0,
    })),
    [{ as_of: asOf, tier1_amt: fx.tier1 }],
  );
}

/** Runs the compiled SQL of `rule` against each test's fixture. */
export async function runTests(rule: Rule, tests: TestCase[]): Promise<TestResult[]> {
  const compiled = compileRule(rule);
  const results: TestResult[] = [];
  for (const tc of tests) {
    let fired = false;
    if (rule.applies_to.includes(tc.fixture.entity)) {
      const db = await fixtureDb(tc.fixture);
      fired = runQuery(db, compiled.sql).length > 0;
      db.close();
    }
    results.push({
      id: tc.id,
      ruleId: tc.ruleId,
      name: tc.name,
      given: tc.given,
      expectFire: tc.expectFire,
      fired,
      pass: fired === tc.expectFire,
    });
  }
  return results;
}
