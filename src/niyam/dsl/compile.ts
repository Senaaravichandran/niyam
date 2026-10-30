import { metricById } from "../data/semanticModel";
import type { Rule } from "./schema";

/**
 * Compiles a rule to SQL over the semantic model's physical tables.
 *
 * The output is plain analytical SQL (CTEs + window functions) that runs unchanged on DuckDB and
 * on SQLite. Percentages are computed as ROUND(num * 100.0 / den, 6) so a value that sits exactly
 * on a regulatory threshold (12.000000) compares as equal instead of 12.000000000000002.
 */

export interface CompiledRule {
  ruleId: string;
  version: number;
  sql: string;
  /** Grain of the alerts the query produces. */
  grain: "counterparty" | "group" | "bank";
}

function pct(num: string, den: string) {
  return `ROUND(${num} * 100.0 / NULLIF(${den}, 0), 6)`;
}

export function compileRule(rule: Rule): CompiledRule {
  const metric = metricById(rule.when.metric);
  if (!metric) throw new Error(`Unknown metric ${rule.when.metric}`);
  const { op, value } = rule.when;
  const sqlOp = op === "==" ? "=" : op;
  // Comment text is sanitised again here so no field can ever end the comment.
  const safe = (t: string) => t.replace(/[\r\n\u2028\u2029]+/g, " ").replace(/[^\x20-\x7e]/g, "?");
  const header = `-- ${safe(rule.rule_id)} v${rule.version} | ${safe(rule.source.circular)} para ${safe(rule.source.clause)}\n-- "${safe(rule.source.span)}"`;

  let body: string;
  if (metric.grain === "counterparty" || metric.grain === "group") {
    const key = metric.grain === "counterparty" ? "borrower_id" : "group_id";
    const unless =
      rule.unless === "board_approved"
        ? "\n  AND MAX(l.board_approved) = 0"
        : "";
    body = `SELECT l.as_of AS as_of,
       l.${key} AS subject_id,
       ${pct("SUM(l.outstanding_amt)", "c.tier1_amt")} AS metric_value
FROM loans l
JOIN capital c ON c.as_of = l.as_of
GROUP BY l.as_of, l.${key}, c.tier1_amt
HAVING ${pct("SUM(l.outstanding_amt)", "c.tier1_amt")} ${sqlOp} ${value}${unless}
ORDER BY as_of, subject_id`;
  } else {
    body = `WITH borrower_totals AS (
  SELECT as_of, borrower_id, SUM(outstanding_amt) AS amt
  FROM loans
  GROUP BY as_of, borrower_id
),
ranked AS (
  SELECT as_of, amt,
         ROW_NUMBER() OVER (PARTITION BY as_of ORDER BY amt DESC, borrower_id) AS rk
  FROM borrower_totals
),
share AS (
  SELECT as_of,
         ${pct("SUM(CASE WHEN rk <= 20 THEN amt ELSE 0 END)", "SUM(amt)")} AS metric_value
  FROM ranked
  GROUP BY as_of
)
SELECT as_of, 'BANK' AS subject_id, metric_value
FROM share
WHERE metric_value ${sqlOp} ${value}
ORDER BY as_of`;
  }

  return {
    ruleId: rule.rule_id,
    version: rule.version,
    sql: `${header}\n${body};`,
    grain: metric.grain,
  };
}
