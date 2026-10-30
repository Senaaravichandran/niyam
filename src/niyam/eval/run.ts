import { segment } from "../agents/reader";
import { extractClause, interpretComparator } from "../agents/extractor";
import { CIRCULAR } from "../data/circular";
import { metricForText } from "../data/semanticModel";
import { parseRule, RuleParseError, toYaml, type Rule } from "../dsl/schema";
import { generateTests, runTests } from "../dsl/testgen";
import type { Clause, Obligation, TestResult } from "../types";
import { EVAL_CLAUSES, type Gold, type GoldKind } from "./clauses";
import { CONTROL, SEEDED_BUGS, type SeededBug } from "./bugs";

/**
 * Evaluation harness. Two honest measurements, both on the real code paths:
 *  1. Extraction: the rule-based Extractor (extractClause + the semantic model's metric resolver)
 *     against 30 hand-labelled synthetic clauses.
 *  2. Validation: ten seeded-bug drafts of SYN-EXP-012 v2 plus the correct rule as a control,
 *     checked by the Validator's static comparisons and by tests generated from the obligation
 *     (generateTests + compileRule + runTests on SQLite/WASM).
 */

export type Field = "kind" | "operator" | "threshold" | "metric";
export const FIELDS: Field[] = ["kind", "operator", "threshold", "metric"];

export interface FieldScore {
  /** Clauses where gold or prediction carries a value for this field. */
  n: number;
  /** Predictions made (extractor produced a value). */
  predicted: number;
  /** Gold values present. */
  gold: number;
  /** Predicted values equal to gold. */
  truePositives: number;
  precision: number;
  recall: number;
  /** Exact agreement over all clauses, where "no value" agreeing with "no value" counts. */
  correct: number;
  accuracy: number;
}

export interface Got {
  kind: GoldKind;
  metric: string | null;
  operator: string | null;
  threshold: number | null;
  unit: string | null;
  comparatorPhrase?: string;
  obligations: number;
}

export interface ExtractionFailure {
  id: string;
  text: string;
  trap?: string;
  note?: string;
  gold: Gold;
  got: Got;
  wrongFields: Field[];
}

export interface BugResult {
  id: string;
  label: string;
  consequence: string;
  /** Static checks (mirroring validator.ts) that objected. */
  staticCodes: string[];
  staticDetail: string[];
  /** Generated tests that failed against the draft. */
  failingTests: { name: string; given: string; expectFire: boolean; fired: boolean }[];
  testsRun: number;
  caught: boolean;
  caughtBy: string[];
}

export interface EvalReport {
  extraction: {
    n: number;
    perField: Record<Field, FieldScore>;
    allFieldsCorrect: number;
    failures: ExtractionFailure[];
  };
  validator: {
    bugs: number;
    caught: number;
    caughtByStatic: number;
    caughtByTests: number;
    missed: { id: string; label: string }[];
    falsePositivesOnControl: number;
    control: BugResult;
    results: BugResult[];
    obligation: { id: string; clause: string; metric?: string; operator?: string; threshold?: number; scope: string[]; span: string };
  };
  durationMs: number;
  generatedAt: string;
  synthetic: true;
}

/* ---------- extraction ---------- */

const resolveMetric = (t: string) => metricForText(t)?.id ?? null;

function toClause(i: number, text: string, scope: Clause["scope"]): Clause {
  const number = String(i + 1);
  return { id: `CL-EVAL-${number}`, number, heading: "Evaluation", text, applicability: "applies", reason: "evaluation", scope };
}

function predict(clause: Clause): Got {
  const obs = extractClause(clause, "RBI-SYN-EVAL-000", "2026-12-01", resolveMetric);
  // Score the first obligation; the extractor emits one quantitative obligation per clause at most.
  const o = obs[0];
  if (!o) return { kind: "none", metric: null, operator: null, threshold: null, unit: null, obligations: 0 };
  return {
    kind: o.kind,
    metric: o.metric ?? null,
    operator: o.operator ?? null,
    threshold: o.threshold ?? null,
    unit: o.unit ?? null,
    comparatorPhrase: o.comparatorPhrase,
    obligations: obs.length,
  };
}

function goldValue(g: Gold, f: Field): string | number | null {
  if (f === "kind") return g.kind === "none" ? null : g.kind;
  if (g.kind !== "quantitative") return null;
  if (f === "metric") return g.metric ?? null;
  if (f === "operator") return g.operator ?? null;
  return g.threshold == null ? null : `${g.threshold} ${g.unit ?? "pct"}`;
}

function gotValue(x: Got, f: Field): string | number | null {
  if (f === "kind") return x.kind === "none" ? null : x.kind;
  if (f === "metric") return x.metric;
  if (f === "operator") return x.operator;
  return x.threshold == null ? null : `${x.threshold} ${x.unit ?? "pct"}`;
}

const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);

export function runExtractionEval() {
  const scores = Object.fromEntries(
    FIELDS.map((f) => [f, { n: 0, predicted: 0, gold: 0, truePositives: 0, precision: 0, recall: 0, correct: 0, accuracy: 0 }]),
  ) as Record<Field, FieldScore>;
  const failures: ExtractionFailure[] = [];
  let allFieldsCorrect = 0;

  EVAL_CLAUSES.forEach((c, i) => {
    const got = predict(toClause(i, c.text, c.scope));
    const wrong: Field[] = [];
    for (const f of FIELDS) {
      const g = goldValue(c.gold, f);
      const p = gotValue(got, f);
      const s = scores[f];
      if (g != null || p != null) s.n += 1;
      if (p != null) s.predicted += 1;
      if (g != null) s.gold += 1;
      if (p != null && g != null && p === g) s.truePositives += 1;
      if (p === g) s.correct += 1;
      else wrong.push(f);
    }
    if (wrong.length) failures.push({ id: c.id, text: c.text, trap: c.trap, note: c.note, gold: c.gold, got, wrongFields: wrong });
    else allFieldsCorrect += 1;
  });

  for (const f of FIELDS) {
    const s = scores[f];
    s.precision = ratio(s.truePositives, s.predicted);
    s.recall = ratio(s.truePositives, s.gold);
    s.accuracy = s.correct / EVAL_CLAUSES.length;
  }
  return { n: EVAL_CLAUSES.length, perField: scores, allFieldsCorrect, failures };
}

/* ---------- validation ---------- */

/** The gold obligation and the policy constraint, produced by the real Reader + Extractor on the circular. */
export function goldObligations(): { target: Obligation; all: Obligation[] } {
  const { clauses, effectiveFrom } = segment(CIRCULAR.ref, CIRCULAR.text, "UCB");
  const all = clauses
    .filter((c) => c.applicability === "applies")
    .flatMap((c) => extractClause(c, CIRCULAR.ref, effectiveFrom, resolveMetric));
  const target = all.find((o) => o.id === "OBL-017-4b");
  if (!target) throw new Error("Evaluation could not derive OBL-017-4b from the circular");
  return { target, all };
}

/** Static checks, the same comparisons validateDraft makes against the obligation. */
export function staticChecks(rule: Rule, ob: Obligation, all: Obligation[]) {
  const codes: string[] = [];
  const detail: string[] = [];
  if (rule.when.op !== ob.operator) {
    const meaning = interpretComparator(ob.comparatorPhrase ?? "")?.meaning ?? "";
    codes.push("OP-FIDELITY");
    detail.push(`op "${rule.when.op}", expected "${ob.operator}" ("${ob.comparatorPhrase}": ${meaning})`);
  }
  if (rule.when.value !== ob.threshold) {
    codes.push("THRESHOLD");
    detail.push(`value ${rule.when.value}, expected ${ob.threshold}`);
  }
  if (rule.when.metric !== ob.metric) {
    codes.push("METRIC");
    detail.push(`metric ${rule.when.metric}, expected ${ob.metric}`);
  }
  if (rule.when.unit !== ob.unit) {
    codes.push("UNIT");
    detail.push(`unit ${rule.when.unit}, expected ${ob.unit}`);
  }
  const scopeA = [...rule.applies_to].sort().join(",");
  const scopeB = [...ob.scope].sort().join(",");
  if (scopeA !== scopeB) {
    codes.push("SCOPE");
    detail.push(`applies_to [${scopeA}], expected [${scopeB}]`);
  }
  if (rule.source.span !== ob.span) {
    codes.push("SPAN");
    detail.push(`span "${rule.source.span}", expected "${ob.span}"`);
  }
  const constraint = all.find((o) => o.action === "policy_constraint" && o.span.includes(`paragraph ${ob.clauseNumber}`));
  if (rule.unless && constraint) {
    codes.push("POLICY-OVERRIDE");
    detail.push(`unless: ${rule.unless}, forbidden by para ${constraint.clauseNumber}: "${constraint.span}"`);
  }
  return { codes, detail };
}

async function checkDraft(bug: SeededBug, ob: Obligation, all: Obligation[]): Promise<BugResult> {
  let rule: Rule;
  const codes: string[] = [];
  const detail: string[] = [];
  try {
    // Round-trip through YAML and the schema, as dsl_validate does.
    rule = parseRule(toYaml(bug.rule));
  } catch (e) {
    const issues = e instanceof RuleParseError ? e.issues.join("; ") : (e as Error).message;
    return {
      id: bug.id,
      label: bug.label,
      consequence: bug.consequence,
      staticCodes: ["SCHEMA"],
      staticDetail: [issues],
      failingTests: [],
      testsRun: 0,
      caught: true,
      caughtBy: ["SCHEMA"],
    };
  }
  const s = staticChecks(rule, ob, all);
  codes.push(...s.codes);
  detail.push(...s.detail);

  // The live pipeline's Mapper records a Board-override policy conflict on this obligation,
  // so the Validator generates the Board-approval test too.
  const tests = generateTests(rule.rule_id, ob, { boardOverrideTest: true });
  const results: TestResult[] = await runTests(rule, tests);
  const failing = results.filter((r) => !r.pass);
  const caughtBy = [...codes, ...failing.map((f) => `test: ${f.name}`)];
  return {
    id: bug.id,
    label: bug.label,
    consequence: bug.consequence,
    staticCodes: codes,
    staticDetail: detail,
    failingTests: failing.map((f) => ({ name: f.name, given: f.given, expectFire: f.expectFire, fired: f.fired })),
    testsRun: results.length,
    caught: caughtBy.length > 0,
    caughtBy,
  };
}

export async function runValidatorEval() {
  const { target, all } = goldObligations();
  const results: BugResult[] = [];
  for (const b of SEEDED_BUGS) results.push(await checkDraft(b, target, all));
  const control = await checkDraft(CONTROL, target, all);
  return {
    bugs: SEEDED_BUGS.length,
    caught: results.filter((r) => r.caught).length,
    caughtByStatic: results.filter((r) => r.staticCodes.length > 0).length,
    caughtByTests: results.filter((r) => r.failingTests.length > 0).length,
    missed: results.filter((r) => !r.caught).map((r) => ({ id: r.id, label: r.label })),
    falsePositivesOnControl: control.caught ? 1 : 0,
    control,
    results,
    obligation: {
      id: target.id,
      clause: target.clauseNumber,
      metric: target.metric,
      operator: target.operator,
      threshold: target.threshold,
      scope: target.scope,
      span: target.span,
    },
  };
}

export async function runEval(): Promise<EvalReport> {
  const t0 = performance.now();
  const extraction = runExtractionEval();
  const validator = await runValidatorEval();
  return {
    extraction,
    validator,
    durationMs: Math.round(performance.now() - t0),
    generatedAt: new Date().toISOString(),
    synthetic: true,
  };
}
