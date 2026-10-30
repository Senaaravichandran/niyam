import { describe, expect, it } from "vitest";
import { DAYS, generateLoanBook } from "@/niyam/data/loanBook";
import { bucket, CANARY_PCT } from "@/niyam/agents/release";

describe("generateLoanBook determinism", () => {
  it("yields identical rows on two calls with the default seed", () => {
    const a = generateLoanBook();
    const b = generateLoanBook();
    expect(a.loans.length).toBeGreaterThan(0);
    expect(b.loans).toEqual(a.loans);
    expect(b.capital).toEqual(a.capital);
    expect(b.dates).toEqual(a.dates);
  });

  it("first 90 days are identical when generating 102 days", () => {
    const base = generateLoanBook();
    const longer = generateLoanBook(undefined, DAYS + 12);
    expect(base.dates).toHaveLength(DAYS);
    expect(longer.dates).toHaveLength(DAYS + 12);
    expect(longer.dates.slice(0, DAYS)).toEqual(base.dates);
    const cutoff = new Set(base.dates);
    expect(longer.loans.filter((r) => cutoff.has(r.as_of))).toEqual(base.loans);
    expect(longer.capital.slice(0, DAYS)).toEqual(base.capital);
  });

  it("a different seed produces a different book", () => {
    const a = generateLoanBook(1, 5);
    const b = generateLoanBook(2, 5);
    expect(a.loans.map((r) => r.outstanding_amt)).not.toEqual(b.loans.map((r) => r.outstanding_amt));
  });
});

describe("release bucket()", () => {
  it("is stable for the same subject id", () => {
    for (const id of ["GRP-001", "BRW-0042", "BANK", ""]) {
      expect(bucket(id)).toBe(bucket(id));
    }
    expect(bucket("GRP-001")).toBe(bucket(`GRP-${"001"}`));
  });

  it("always returns an integer in [0, 100)", () => {
    for (let k = 0; k < 500; k++) {
      const b = bucket(`BRW-${k}`);
      expect(Number.isInteger(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  it(`puts roughly ${CANARY_PCT}% of 1000 ids in the canary (bucket < ${CANARY_PCT})`, () => {
    const ids = Array.from({ length: 1000 }, (_, k) => `BRW-${String(k + 1).padStart(4, "0")}`);
    const inCanary = ids.filter((id) => bucket(id) < CANARY_PCT).length;
    expect(inCanary).toBeGreaterThanOrEqual(60);
    expect(inCanary).toBeLessThanOrEqual(140);
  });
});
