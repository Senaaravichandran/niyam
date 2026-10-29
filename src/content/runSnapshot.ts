/**
 * Snapshot of one deterministic run of the synthetic demo (rule-based path, seed 20261201),
 * produced by `npm run demo`. Used for the static fragments on the landing page; the console
 * runs the pipeline live.
 */
export const SNAPSHOT = {
  backtest: {
    first: "2026-07-01",
    last: "2026-09-28",
    old: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    new: [7, 7, 6, 5, 4, 4, 4, 4, 5, 6, 6, 6, 6, 6, 5, 5, 6, 5, 5, 6, 6, 6, 6, 6, 6, 6, 5, 7, 6, 6, 6, 6, 5, 6, 6, 6, 7, 6, 5, 6, 6, 7, 6, 6, 6, 7, 7, 7, 8, 8, 9, 8, 9, 9, 9, 10, 7, 6, 6, 6, 5, 6, 6, 6, 6, 7, 6, 7, 7, 7, 7, 6, 6, 7, 7, 8, 8, 9, 10, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9, 8],
    oldTotal: 115,
    newTotal: 601,
  },
  gitLog: [
    ["faf7ed1", "SYN-EXP-012 v2: resolve OBJ-EXP-012-01 (OP-FIDELITY+POLICY-OVERRIDE)", "NIYAM Author Agent"],
    ["e041ec8", "SYN-CON-020 v1: add for RBI-SYN-2026-017 para 4(c)", "NIYAM Author Agent"],
    ["081cf52", "SYN-EXP-012 v2: amend for RBI-SYN-2026-017 para 4(b)", "NIYAM Author Agent"],
    ["45a530f", "SYN-EXP-011 v2: amend for RBI-SYN-2026-017 para 4(a)", "NIYAM Author Agent"],
    ["574faff", "Seed live rules v1 from MD-SYN-LEF-2025", "Bank Rule Ops (seed)"],
  ],
  sql: `-- SYN-EXP-012 v2 | RBI-SYN-2026-017 para 4(b)
SELECT l.as_of, l.group_id AS subject_id,
  ROUND(SUM(l.outstanding_amt) * 100.0
        / NULLIF(c.tier1_amt, 0), 6) AS metric_value
FROM loans l
JOIN capital c ON c.as_of = l.as_of
GROUP BY l.as_of, l.group_id, c.tier1_amt
HAVING ROUND(SUM(l.outstanding_amt) * 100.0
        / NULLIF(c.tier1_amt, 0), 6) > 12`,
};
