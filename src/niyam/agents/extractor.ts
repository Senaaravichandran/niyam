import type { Operator } from "../dsl/schema";
import { metricById } from "../data/semanticModel";
import type { NiyamContext } from "../context";
import type { AgentTools } from "../mcp/client";
import { LLM_MODEL, llmAvailable, llmExtract } from "../llm/claude";
import type { Clause, Obligation, RejectedObligation } from "../types";

/**
 * Extractor: applicable clause -> typed obligation with an exact source span.
 * The rule-based path reads the comparator phrase; the LLM path asks Claude. Both are verified the
 * same way: a span that is not an exact substring of its clause is rejected, never repaired.
 */

/** Comparator phrases mapped to the condition under which a rule must fire. */
export const COMPARATORS: { re: RegExp; fire: Operator; meaning: string }[] = [
  { re: /equal to or (?:more than|exceeding|above|greater than)|or more\b/i, fire: ">=", meaning: "inclusive: reaching the limit already triggers" },
  { re: /shall not exceed|does not exceed|do not exceed|not more than|up to and including|not exceeding/i, fire: ">", meaning: "a ceiling: breached only when strictly above" },
  { re: /not less than|at least|no less than/i, fire: "<", meaning: "a floor: breached only when strictly below" },
  { re: /exceeding|exceeds|in excess of|more than|greater than|above/i, fire: ">", meaning: "strictly greater; equality does not trigger" },
  { re: /less than|below/i, fire: ">=", meaning: "must stay strictly below" },
];

/** A percentage written as "12 per cent", "12 percent" or "12%", followed by its base. */
const NUMBER_PCT = /(\d+(?:\.\d+)?)\s*(?:per\s?cent|%)\s+of (?:its |the )?([A-Za-z0-9 ]+?)(?=[.,;)]|$)/i;

/** The comparator that governs a number is the closest one written before it. */
function governingComparator(text: string, numberIdx: number) {
  let best: { c: (typeof COMPARATORS)[number]; m: RegExpMatchArray; idx: number } | undefined;
  for (const c of COMPARATORS) {
    const re = new RegExp(c.re.source, "gi");
    for (const m of text.matchAll(re)) {
      const idx = m.index ?? -1;
      if (idx < 0 || idx > numberIdx) continue;
      const end = idx + m[0].length;
      // Prefer the comparator ending closest to the number; on ties, the longer phrase.
      if (!best || end > best.idx + best.m[0].length || (end === best.idx + best.m[0].length && m[0].length > best.m[0].length)) {
        best = { c, m, idx };
      }
    }
  }
  return best;
}

export function interpretComparator(phrase: string) {
  return COMPARATORS.find((c) => c.re.test(phrase));
}

function obligationId(circularRef: string, clauseNumber: string, n = 1) {
  const short = circularRef.replace(/[^0-9]/g, "").slice(-3);
  return `OBL-${short}-${clauseNumber.replace(/[()]/g, "")}${n > 1 ? `-${n}` : ""}`;
}

function actionFor(text: string) {
  if (/flag for report/i.test(text)) return "flag_for_report";
  if (/shall not take an exposure/i.test(text)) return "block_new_exposure";
  return "raise_alert";
}

function locate(text: string, span: string) {
  const start = text.indexOf(span);
  return { start, end: start < 0 ? -1 : start + span.length };
}

/** Rule-based extraction for one clause. */
export function extractClause(
  clause: Clause,
  circularRef: string,
  effectiveFrom: string,
  resolveMetric: (t: string) => string | null,
): Obligation[] {
  const text = clause.text;
  const out: Obligation[] = [];
  const pct = text.match(NUMBER_PCT);
  // Definitions ("X means ...") describe, they do not oblige.
  const isDefinition = /\bmeans\b/i.test(text) && !/\b(shall|must)\b/i.test(text);
  const found = pct && !isDefinition ? governingComparator(text, text.indexOf(pct[0])) : undefined;
  const comp = found ? { c: found.c, m: found.m } : undefined;

  if (pct && comp?.m) {
    const metric = resolveMetric(text);
    // Span: from the nearest "exposure" before the comparator to the end of "per cent of ...".
    const compIdx = found!.idx;
    const before = text.slice(0, compIdx);
    const expoIdx = before.lastIndexOf("exposure");
    const aggIdx = before.lastIndexOf("aggregate exposure");
    const startIdx = aggIdx >= 0 && aggIdx >= expoIdx - 10 ? aggIdx : expoIdx >= 0 ? expoIdx : compIdx;
    const pctEnd = text.indexOf(pct[0]) + pct[0].length;
    const span = text.slice(startIdx, pctEnd);
    const { start, end } = locate(text, span);
    out.push({
      id: obligationId(circularRef, clause.number),
      clauseId: clause.id,
      clauseNumber: clause.number,
      kind: "quantitative",
      modality: /shall not/i.test(text) ? "MUST_NOT" : "MUST",
      actor: "RegulatedEntity",
      metric: metric ?? undefined,
      operator: comp.c.fire,
      comparatorPhrase: comp.m[0],
      threshold: Number(pct[1]),
      unit: "pct",
      action: actionFor(text),
      effectiveFrom,
      scope: clause.scope,
      span,
      spanStart: start,
      spanEnd: end,
      extractedBy: "rule-based",
    });
    return out;
  }

  // Procedural obligations: deadlines and constraints on internal policy.
  const deadline = text.match(/shall be placed before the Board of Directors within \d+ days/i);
  if (deadline) {
    const { start, end } = locate(text, deadline[0]);
    out.push({
      id: obligationId(circularRef, clause.number, 1),
      clauseId: clause.id,
      clauseNumber: clause.number,
      kind: "procedural",
      modality: "MUST",
      actor: "RegulatedEntity",
      action: "board_report",
      effectiveFrom,
      scope: clause.scope,
      span: deadline[0],
      spanStart: start,
      spanEnd: end,
      extractedBy: "rule-based",
    });
  }
  const constraint = text.match(/no internal policy shall permit [^,.;]+/i);
  if (constraint) {
    const { start, end } = locate(text, constraint[0]);
    out.push({
      id: obligationId(circularRef, clause.number, 2),
      clauseId: clause.id,
      clauseNumber: clause.number,
      kind: "procedural",
      modality: "MUST_NOT",
      actor: "RegulatedEntity",
      action: "policy_constraint",
      effectiveFrom,
      scope: clause.scope,
      span: constraint[0],
      spanStart: start,
      spanEnd: end,
      extractedBy: "rule-based",
    });
  }
  return out;
}

export async function runExtractor(ctx: NiyamContext, tools: AgentTools, effectiveFrom: string) {
  const clauses = await tools.call<Clause[]>("kg_read_clauses", { only_applicable: true });
  const obligations: Obligation[] = [];
  const rejected: RejectedObligation[] = [];
  const metricCache = new Map<string, string | null>();
  const resolve = async (t: string) => {
    if (!metricCache.has(t)) {
      const r = await tools.call<{ metric: string | null }>("sm_resolve_metric", { text: t });
      metricCache.set(t, r.metric);
    }
    return metricCache.get(t)!;
  };
  for (const c of clauses) await resolve(c.text);
  const resolveSync = (t: string) => metricCache.get(t) ?? null;

  let usedLlm = false;
  if (ctx.path === "llm" && llmAvailable()) {
    try {
      const proposals = await llmExtract(clauses);
      usedLlm = true;
      const perClause = new Map<string, number>();
      for (const p of proposals) {
        const clause = clauses.find((c) => c.number === p.clause_number);
        if (!clause) {
          rejected.push({ clauseNumber: p.clause_number, span: p.span, reason: "Unknown clause number" });
          continue;
        }
        const { start, end } = locate(clause.text, p.span);
        if (start < 0) {
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
          id: obligationId(ctx.circular.ref, clause.number, n),
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
          spanEnd: end,
          extractedBy: "llm",
        });
      }
      ctx.llmNotes.push(`Extractor used ${LLM_MODEL}: ${proposals.length} proposed, ${rejected.length} rejected by span verification`);
    } catch (e) {
      ctx.llmNotes.push(`Extractor LLM call failed (${(e as Error).message}); fell back to rule-based extraction`);
    }
  }
  if (!usedLlm) {
    for (const c of clauses) obligations.push(...extractClause(c, ctx.circular.ref, effectiveFrom, resolveSync));
  }

  // Exact-substring verification happens again on the graph write; a mismatch throws there too.
  await tools.call("kg_write_obligations", {
    obligations: obligations.map((o) => ({ ...o })),
  });
  ctx.obligations = obligations;
  ctx.rejected = rejected;
  return { obligations, rejected, usedLlm };
}
