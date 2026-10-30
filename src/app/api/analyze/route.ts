import { COMPARATORS, extractClause, interpretComparator } from "@/niyam/agents/extractor";
import { scopeFromText, segment } from "@/niyam/agents/reader";
import { ENTITY_LABEL, type EntityType } from "@/niyam/data/bankProfile";
import { METRICS, metricById, metricForText } from "@/niyam/data/semanticModel";
import { RuleSchema, toYaml, type Operator, type Rule } from "@/niyam/dsl/schema";
import { generateTests, runTests } from "@/niyam/dsl/testgen";
import { LLM_MODEL, llmAvailable, llmExtract } from "@/niyam/llm/claude";
import type { Clause, Obligation, RejectedObligation, TestCase } from "@/niyam/types";
import { allowLlm, clientIp } from "../_lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Analysis only. Runs the Reader and Extractor logic on text a visitor pastes, drafts a rule for
 * each quantitative obligation whose metric the semantic model knows, and runs the boundary tests
 * generated from the obligation. Nothing is written to the graph, the rule repo or the live engine.
 */

const ENTITIES: EntityType[] = ["UCB", "NBFC-ML", "NBFC-UL", "SCB"];
const MAX_CHARS = 20_000;
const MAX_CLAUSES = 200;
const LLM_TIMEOUT_MS = 45_000;

/** Extra business phrases for pasted text. Same metric ids as the semantic model; no new metrics. */
const EXTRA_PHRASES: { metric: string; phrases: string[] }[] = [
  { metric: "group_exposure_pct_tier1", phrases: ["group of borrowers", "group of connected borrowers", "borrower group", "connected counterparties"] },
  { metric: "counterparty_exposure_pct_tier1", phrases: ["single borrower", "individual borrower", "single party", "one counterparty"] },
  { metric: "top20_share_pct_loans", phrases: ["20 largest borrowers", "top twenty borrowers", "top 20 borrowers"] },
];

function resolveMetric(text: string): string | null {
  const known = metricForText(text);
  if (known) return known.id;
  const t = text.toLowerCase();
  return EXTRA_PHRASES.find((e) => e.phrases.some((p) => t.includes(p)))?.metric ?? null;
}

const INFORMATIONAL = /^(short title|applicability|definitions?|repeal|commencement)/i;
const DEONTIC = /\bshall\b(?! be called| come into force| apply| be reckoned| mean)|\bshall not\b|\bmust\b/i;

function detectScope(text: string): EntityType[] {
  const t = text.toLowerCase();
  const scope: EntityType[] = [];
  if (/urban\)? co-operative bank|\bucbs?\b/.test(t)) scope.push("UCB");
  if (/middle layer/.test(t)) scope.push("NBFC-ML");
  if (/upper layer/.test(t)) scope.push("NBFC-UL");
  if (/scheduled commercial bank/.test(t)) scope.push("SCB");
  return scope;
}

const OP_MEANING: Record<Operator, string> = {
  ">": "fires only when the value is strictly greater than the limit; a value exactly on the limit is compliant",
  ">=": "fires when the value reaches or passes the limit",
  "<": "fires only when the value is strictly below the floor; a value exactly on the floor is compliant",
  "<=": "fires when the value falls to or below the limit",
  "==": "fires only on equality",
};

function comparatorWhy(phrase: string | undefined, op: Operator | undefined) {
  if (!op) return undefined;
  const c = phrase ? interpretComparator(phrase) : undefined;
  const head = phrase ? `"${phrase}"` : "The comparator";
  if (c && c.fire === op) return `${head} is ${c.meaning}, so the rule fires on ${op}: it ${OP_MEANING[op]}.`;
  return `${head} was read as a breach condition of ${op}: the rule ${OP_MEANING[op]}.`;
}

function refFrom(text: string) {
  const m = text.match(/RBI\/\d{4}-\d{2}\/[A-Z]*-?\d+/);
  return m ? m[0] : "USR-000";
}

function shortRef(ref: string) {
  return ref.replace(/[^0-9]/g, "").slice(-3) || "000";
}

/** Gives unnumbered text RBI-style numbering so the Reader can segment it. */
function numberBlocks(text: string): { text: string; count: number } {
  let blocks = text
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
  if (blocks.length === 1) {
    blocks = blocks[0]
      .split(/(?<=[.;])\s+(?=[A-Z(])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  blocks = blocks.slice(0, MAX_CLAUSES);
  return { text: blocks.map((b, i) => `${i + 1}. Paragraph ${i + 1}. ${b}`).join("\n"), count: blocks.length };
}

function bad(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

type Body = { text?: unknown; entityType?: unknown; useLlm?: unknown };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Body must be JSON: {text, entityType, useLlm?}");
  }
  if (!body || typeof body !== "object") return bad("Body must be a JSON object");
  const { text, entityType, useLlm } = body;
  if (typeof text !== "string" || !text.trim()) return bad("text must be a non-empty string");
  if (text.length > MAX_CHARS) return bad(`text must be at most ${MAX_CHARS} characters (got ${text.length})`);
  if (typeof entityType !== "string" || !ENTITIES.includes(entityType as EntityType))
    return bad(`entityType must be one of ${ENTITIES.join(", ")}`);
  if (useLlm !== undefined && typeof useLlm !== "boolean") return bad("useLlm must be a boolean when present");
  const entity = entityType as EntityType;
  const notes: string[] = [];

  // 1. Reader: segment and scope.
  const ref = refFrom(text);
  const numbered = text.split(/\r?\n/).some((l) => /^\s*\d+\.\s+[^.]+\./.test(l));
  let source = text;
  if (!numbered) {
    const n = numberBlocks(text);
    source = n.text;
    notes.push(`No RBI-style numbered paragraphs ("4. Heading. text") were found, so each paragraph or sentence was treated as a clause, numbered 1 to ${n.count}.`);
  }
  const seg = segment(ref, source, entity);
  let clauses: Clause[] = seg.clauses.slice(0, MAX_CLAUSES);
  if (!clauses.length) return bad("No clause text could be read from the input");

  const hasApplicability = clauses.some((c) => /^applicability/i.test(c.heading ?? ""));
  if (!hasApplicability) {
    const detected = detectScope(text);
    const scope = detected.length ? detected : [entity];
    notes.push(
      detected.length
        ? `No applicability paragraph was found; the scope ${detected.join(", ")} was read from the addressees and body of the text.`
        : `No applicability paragraph or recognisable addressee was found, so the text was assumed to apply to the selected entity type (${entity}).`,
    );
    clauses = clauses.map((c) => {
      if (scopeFromText(c.text) || INFORMATIONAL.test(c.heading ?? "")) return c;
      if (!scope.includes(entity))
        return { ...c, scope, applicability: "not_applicable", reason: `Applies to ${scope.join(", ")} only; selected entity is ${entity}` };
      if (!DEONTIC.test(c.text)) return { ...c, scope, applicability: "informational", reason: "No obligation verb (shall, shall not, must)" };
      return { ...c, scope, applicability: "applies", reason: `Scope ${scope.join(", ")} includes ${entity}` };
    });
  }
  const effectiveFrom = seg.effectiveFrom;
  const applicable = clauses.filter((c) => c.applicability === "applies");

  // 2. Extractor: rule-based by default, Claude on request, both verified by exact substring.
  let path: "rule-based" | "llm" = "rule-based";
  const obligations: Obligation[] = [];
  const rejected: RejectedObligation[] = [];
  if (useLlm) {
    if (!llmAvailable()) notes.push("Claude was requested, but this deployment has no ANTHROPIC_API_KEY; the rule-based extractor ran instead.");
    else if (!allowLlm(clientIp(req))) notes.push("Claude rate limit reached for your address (4 runs per 10 minutes); the rule-based extractor ran instead.");
    else if (!applicable.length) notes.push("No clause applies to the selected entity type, so Claude was not called.");
    else {
      try {
        const proposals = await Promise.race([
          llmExtract(applicable),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timed out")), LLM_TIMEOUT_MS)),
        ]);
        path = "llm";
        const perClause = new Map<string, number>();
        const short = shortRef(ref);
        for (const p of proposals) {
          const clause = applicable.find((c) => c.number === p.clause_number);
          if (!clause) {
            rejected.push({ clauseNumber: p.clause_number, span: p.span, reason: "Unknown or non-applicable clause number" });
            continue;
          }
          const start = clause.text.indexOf(p.span);
          if (!p.span || start < 0) {
            rejected.push({ clauseNumber: p.clause_number, span: p.span, reason: "Span is not an exact substring of the clause" });
            continue;
          }
          if (p.kind === "quantitative" && (!p.metric || !metricById(p.metric) || p.threshold == null || !p.operator)) {
            rejected.push({ clauseNumber: p.clause_number, span: p.span, reason: "Quantitative obligation missing a known metric, operator or threshold" });
            continue;
          }
          const n = (perClause.get(clause.number) ?? 0) + 1;
          perClause.set(clause.number, n);
          obligations.push({
            id: `OBL-${short}-${clause.number.replace(/[()]/g, "")}${n > 1 ? `-${n}` : ""}`,
            clauseId: clause.id,
            clauseNumber: clause.number,
            kind: p.kind,
            modality: p.modality,
            actor: "RegulatedEntity",
            metric: p.metric ?? undefined,
            operator: p.operator ?? undefined,
            comparatorPhrase: p.comparator_phrase ?? undefined,
            threshold: p.threshold ?? undefined,
            unit: p.kind === "quantitative" ? "pct" : undefined,
            action: p.action,
            effectiveFrom,
            scope: clause.scope,
            span: p.span,
            spanStart: start,
            spanEnd: start + p.span.length,
            extractedBy: "llm",
          });
        }
        notes.push(`Extractor used ${LLM_MODEL}: ${proposals.length} proposed, ${rejected.length} rejected by verification.`);
      } catch (e) {
        notes.push(`Claude call failed (${(e as Error).message}); the rule-based extractor ran instead.`);
      }
    }
  }
  if (path === "rule-based") {
    for (const c of applicable) {
      for (const o of extractClause(c, ref, effectiveFrom, resolveMetric)) {
        if (o.spanStart < 0 || c.text.slice(o.spanStart, o.spanEnd) !== o.span) {
          rejected.push({ clauseNumber: c.number, span: o.span, reason: "Span is not an exact substring of the clause" });
          continue;
        }
        obligations.push(o);
      }
    }
  }

  // 3. Draft rules and run the boundary tests generated from each obligation.
  const rules: {
    ruleId: string;
    obligationId: string;
    clauseNumber: string;
    yaml: string;
    tests: { id: string; name: string; given: string; expectFire: boolean; fired: boolean; pass: boolean }[];
  }[] = [];
  const explained = [] as (Obligation & {
    metricLabel?: string;
    operatorWhy?: string;
    ruleId?: string;
    noRuleReason?: string;
  })[];

  for (const o of obligations) {
    const metric = o.metric ? metricById(o.metric) : undefined;
    const row: (typeof explained)[number] = { ...o, metricLabel: metric?.label, operatorWhy: comparatorWhy(o.comparatorPhrase, o.operator) };
    explained.push(row);
    if (o.kind !== "quantitative") {
      row.noRuleReason = "Procedural obligation: it becomes a manual control or workflow step, not a numeric rule.";
      continue;
    }
    if (!metric || !o.operator || o.threshold === undefined) {
      row.noRuleReason = `The metric in this clause is not in the bank's semantic model (known: ${METRICS.map((m) => m.label).join("; ")}), so no rule can be compiled. A data owner would add the metric first.`;
      continue;
    }
    const ruleId = `SYN-USR-${String(rules.length + 1).padStart(3, "0")}`;
    const opWord = { ">": "above", ">=": "at or above", "<": "below", "<=": "at or below", "==": "equal to" }[o.operator];
    const candidate: Rule = {
      rule_id: ruleId,
      version: 1,
      status: "draft",
      title: `${metric.label} ${opWord} ${o.threshold}%`,
      applies_to: o.scope.length ? o.scope : [entity],
      when: { metric: metric.id, op: o.operator, value: o.threshold, unit: "pct" },
      action: "raise_alert",
      severity: "medium",
      // The DSL wants a plain reference token: "RBI/2019-20/171" is recorded as "RBI-2019-20-171".
      source: { circular: ref.toUpperCase().replace(/[^A-Z0-9-]+/g, "-").slice(0, 41), clause: o.clauseNumber, obligation: o.id, span: o.span },
    };
    const parsed = RuleSchema.safeParse(candidate);
    if (!parsed.success) {
      row.noRuleReason = `Draft failed the DSL schema: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
      continue;
    }
    const rule = parsed.data;
    // Tests come from the obligation. In-scope fixtures use an entity the rule covers; the
    // out-of-scope fixture uses one it does not, or is dropped when the rule covers all four.
    const outside = ENTITIES.find((e) => !rule.applies_to.includes(e));
    const inside = rule.applies_to.includes(entity) ? entity : rule.applies_to[0];
    const tests: TestCase[] = [];
    for (const t of generateTests(ruleId, o)) {
      if (t.name === "Out of scope entity") {
        if (!outside) continue;
        tests.push({ ...t, given: t.given.replace(/^Scheduled Commercial Bank/, ENTITY_LABEL[outside]), fixture: { ...t.fixture, entity: outside } });
      } else tests.push({ ...t, fixture: { ...t.fixture, entity: inside } });
    }
    const results = await runTests(rule, tests);
    row.ruleId = ruleId;
    rules.push({
      ruleId,
      obligationId: o.id,
      clauseNumber: o.clauseNumber,
      yaml: toYaml(rule),
      tests: results.map(({ id, name, given, expectFire, fired, pass }) => ({ id, name, given, expectFire, fired, pass })),
    });
  }

  if (path === "rule-based") {
    const silent = applicable.filter((c) => !obligations.some((o) => o.clauseId === c.id));
    if (silent.length)
      notes.push(
        `${silent.length} applicable clause${silent.length > 1 ? "s" : ""} (${silent.map((c) => c.number).join(", ")}) had no pattern the rule-based extractor recognises (a "per cent of" limit with a comparator, a Board deadline, or a policy constraint); a reviewer reads these by hand.`,
      );
  }
  notes.push("Analysis only: nothing was written to the knowledge graph, the rule repository or the live engine.");

  return Response.json({
    ref,
    entityType: entity,
    effectiveFrom,
    clauses,
    obligations: explained,
    rejected,
    rules,
    path,
    notes,
    comparators: COMPARATORS.map((c) => ({ pattern: c.re.source, fires: c.fire, meaning: c.meaning })),
  });
}
