/**
 * SYNTHETIC 90-day loan book with a fixed seed.
 * Borrowers belong to groups of connected counterparties. Exposures follow a mean-reverting walk
 * around a target level, so a few groups hover near the old and new limits and cross them on some
 * days but not others. That is what makes the old-versus-new backtest informative.
 */

export const LOAN_BOOK_SEED = 20261201;
export const DAYS = 90;
export const START_DATE = "2026-07-01";
export const TIER1_CR = 412;

export interface LoanRow {
  as_of: string;
  account_id: string;
  borrower_id: string;
  group_id: string;
  sector: string;
  outstanding_amt: number;
  board_approved: number;
}

export interface CapitalRow {
  as_of: string;
  tier1_amt: number;
}

/** mulberry32: small, fast, deterministic PRNG. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SECTORS = ["Trade", "MSME manufacturing", "Housing", "Agri processing", "Services", "Gold loans"];

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

interface Borrower {
  id: string;
  group: string;
  sector: string;
  /** Long-run exposure in INR crore. */
  base: number;
  /** Daily drift of the long-run level. */
  trend: number;
  vol: number;
}

export interface LoanBook {
  loans: LoanRow[];
  capital: CapitalRow[];
  dates: string[];
  borrowers: number;
  groups: number;
}

/**
 * Group exposure targets as % of Tier 1. The first few sit between the new 12% limit and the old
 * 15% limit; that band is exactly where the amended rule changes outcomes.
 */
const LARGE_GROUP_TARGETS = [16.4, 14.6, 13.8, 13.1, 12.5, 12.1, 11.7, 11.2, 10.4, 9.6, 8.9, 8.1];

export function generateLoanBook(seed = LOAN_BOOK_SEED, days = DAYS): LoanBook {
  const rand = mulberry32(seed);
  const borrowers: Borrower[] = [];
  const boardApproved = new Set(["GRP-003", "GRP-005"]);
  const pick = () => SECTORS[Math.floor(rand() * SECTORS.length)];

  // Large connected groups. The lead borrower carries most of the group's exposure.
  LARGE_GROUP_TARGETS.forEach((target, gi) => {
    const gid = `GRP-${String(gi + 1).padStart(3, "0")}`;
    const total = (target / 100) * TIER1_CR;
    const members = 2 + Math.floor(rand() * 3);
    const leadShare = 0.55 + rand() * 0.25;
    for (let m = 0; m < members; m++) {
      const share = m === 0 ? leadShare : (1 - leadShare) / (members - 1);
      borrowers.push({
        id: `BRW-${String(borrowers.length + 1).padStart(4, "0")}`,
        group: gid,
        sector: pick(),
        base: total * share,
        trend: (rand() - 0.5) * 0.0016,
        vol: 0.012 + rand() * 0.01,
      });
    }
  });

  // Mid-sized groups.
  for (let g = LARGE_GROUP_TARGETS.length + 1; g <= 48; g++) {
    const gid = `GRP-${String(g).padStart(3, "0")}`;
    const total = ((1.2 + rand() * 2.2) / 100) * TIER1_CR;
    const members = 2 + Math.floor(rand() * 3);
    for (let m = 0; m < members; m++) {
      borrowers.push({
        id: `BRW-${String(borrowers.length + 1).padStart(4, "0")}`,
        group: gid,
        sector: pick(),
        base: total / members,
        trend: (rand() - 0.5) * 0.001,
        vol: 0.008 + rand() * 0.008,
      });
    }
  }

  // Stand-alone retail and MSME borrowers: many small exposures.
  for (let i = 0; i < 560; i++) {
    borrowers.push({
      id: `BRW-${String(borrowers.length + 1).padStart(4, "0")}`,
      group: `SOLO-${String(i + 1).padStart(4, "0")}`,
      sector: pick(),
      base: 0.15 + rand() * 0.9,
      trend: (rand() - 0.5) * 0.001,
      vol: 0.004 + rand() * 0.006,
    });
  }

  const loans: LoanRow[] = [];
  const capital: CapitalRow[] = [];
  const dates: string[] = [];
  const dev = borrowers.map(() => 0);

  for (let d = 0; d < days; d++) {
    const asOf = addDays(START_DATE, d);
    dates.push(asOf);
    capital.push({ as_of: asOf, tier1_amt: TIER1_CR });
    borrowers.forEach((b, i) => {
      // Mean-reverting deviation around a slowly drifting level.
      dev[i] = 0.86 * dev[i] + (rand() - 0.5) * 2 * b.vol * 2.2;
      const level = b.base * (1 + b.trend * d) * (1 + dev[i]);
      loans.push({
        as_of: asOf,
        account_id: `ACC-${b.id.slice(4)}-01`,
        borrower_id: b.id,
        group_id: b.group,
        sector: b.sector,
        outstanding_amt: Math.max(0.05, Math.round(level * 100) / 100),
        board_approved: boardApproved.has(b.group) ? 1 : 0,
      });
    });
  }

  return {
    loans,
    capital,
    dates,
    borrowers: borrowers.length,
    groups: 48,
  };
}
