import { compileRule } from "@/niyam/dsl/compile";
import { parseRule, RuleParseError, type Rule } from "@/niyam/dsl/schema";
import { getBookDb, runQuery, type AlertRow } from "@/niyam/sql/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Counterfactual threshold sweep. Takes one rule, varies only `when.value`, compiles each variant
 * with the same deterministic compiler and runs it on the same 90-day SYNTHETIC book used by the
 * backtest. Read-only: nothing is written to the rule repo, the graph or the live engine.
 *
 * POST { yaml: string, thresholds?: number[], oldValue?: number }
 *  -> { ruleId, metric, op, value, oldValue, minutesPerAlert, days, synthetic, points: [{ threshold, alerts, subjects, analystHours }] }
 */

const MAX_BODY_BYTES = 20_000;
const MAX_THRESHOLDS = 25;
const DEFAULT_STEPS = 15;
const MINUTES_PER_ALERT = 45;

function bad(status: number, error: string, issues?: string[]) {
  return Response.json({ error, ...(issues ? { issues } : {}) }, { status });
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const roundHalf = (x: number) => Math.round(x * 2) / 2;

function defaultThresholds(value: number, oldValue?: number): number[] {
  const set = new Set<number>();
  const lo = value * 0.6;
  const hi = value * 1.4;
  for (let i = 0; i < DEFAULT_STEPS; i++) {
    const t = roundHalf(lo + ((hi - lo) * i) / (DEFAULT_STEPS - 1));
    set.add(t);
  }
  set.add(value);
  if (oldValue != null && Number.isFinite(oldValue)) set.add(oldValue);
  return [...set].sort((a, b) => a - b);
}

export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  if (!raw) return bad(400, "Empty body");
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return bad(413, `Body exceeds ${MAX_BODY_BYTES} bytes`);

  let body: { yaml?: unknown; thresholds?: unknown; oldValue?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return bad(400, "Body is not valid JSON");
  }
  if (!body || typeof body !== "object" || typeof body.yaml !== "string" || !body.yaml.trim()) {
    return bad(400, "Field `yaml` (string) is required");
  }

  let rule: Rule;
  try {
    rule = parseRule(body.yaml);
  } catch (e) {
    if (e instanceof RuleParseError) return bad(400, "Rule is invalid", e.issues);
    return bad(400, (e as Error).message);
  }

  let oldValue: number | undefined;
  if (body.oldValue != null) {
    if (typeof body.oldValue !== "number" || !Number.isFinite(body.oldValue)) return bad(400, "`oldValue` must be a finite number");
    oldValue = body.oldValue;
  }

  let thresholds: number[];
  if (body.thresholds != null) {
    if (!Array.isArray(body.thresholds) || !body.thresholds.length) return bad(400, "`thresholds` must be a non-empty array of numbers");
    if (body.thresholds.length > MAX_THRESHOLDS) return bad(400, `At most ${MAX_THRESHOLDS} thresholds`);
    if (!body.thresholds.every((t) => typeof t === "number" && Number.isFinite(t) && t >= 0 && t <= 1000)) {
      return bad(400, "`thresholds` must be finite numbers between 0 and 1000");
    }
    thresholds = [...new Set(body.thresholds as number[])].sort((a, b) => a - b);
  } else {
    thresholds = defaultThresholds(rule.when.value, oldValue);
  }
  if (thresholds.length > MAX_THRESHOLDS) thresholds = thresholds.slice(0, MAX_THRESHOLDS);

  const db = await getBookDb();
  const days = Number(db.exec("SELECT COUNT(DISTINCT as_of) FROM capital")[0]?.values[0]?.[0] ?? 0);
  const runAt = (value: number) => runQuery(db, compileRule({ ...rule, when: { ...rule.when, value } }).sql);
  const op = rule.when.op;
  const cmp: Record<string, (x: number, t: number) => boolean> = {
    ">": (x, t) => x > t,
    ">=": (x, t) => x >= t,
    "<": (x, t) => x < t,
    "<=": (x, t) => x <= t,
  };

  /**
   * For monotone operators the alert set at threshold t is a subset of the set at the loosest
   * threshold, so the compiled SQL runs once at that extreme and each point applies the same
   * comparison to the same ROUND(…, 6) metric_value in JS. The rule's own threshold is then run
   * through its compiled SQL directly and must match (`verified`). `==` runs every threshold.
   */
  let rowsFor: (t: number) => AlertRow[];
  let mode: "single-pass" | "per-threshold";
  if (cmp[op]) {
    const loosest = op === ">" || op === ">=" ? thresholds[0] : thresholds[thresholds.length - 1];
    const all = runAt(loosest);
    rowsFor = (t) => all.filter((r) => cmp[op](Number(r.metric_value), t));
    mode = "single-pass";
  } else {
    rowsFor = (t) => runAt(t);
    mode = "per-threshold";
  }

  const points = thresholds.map((threshold) => {
    const rows = rowsFor(threshold);
    return {
      threshold,
      alerts: rows.length,
      subjects: new Set(rows.map((r) => r.subject_id)).size,
      analystHours: round1((rows.length * MINUTES_PER_ALERT) / 60),
    };
  });

  const ownPoint = points.find((p) => p.threshold === rule.when.value);
  const verified = mode === "per-threshold" || !ownPoint || runAt(rule.when.value).length === ownPoint.alerts;
  if (!verified) return bad(500, "Sweep did not reproduce the compiled rule's own result");

  return Response.json({
    ruleId: rule.rule_id,
    title: rule.title,
    metric: rule.when.metric,
    op: rule.when.op,
    unless: rule.unless ?? null,
    value: rule.when.value,
    oldValue: oldValue ?? null,
    minutesPerAlert: MINUTES_PER_ALERT,
    days,
    synthetic: true,
    mode,
    verified,
    points,
  });
}
