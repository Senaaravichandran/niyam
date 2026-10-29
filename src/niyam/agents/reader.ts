import type { EntityType } from "../data/bankProfile";
import type { AgentTools } from "../mcp/client";
import type { NiyamContext } from "../context";
import type { Clause } from "../types";

/**
 * Reader: circular intake and applicability.
 * Segments RBI-style numbering ("4." with "(a)" sub-paragraphs) into clauses with stable IDs and
 * decides, for the bank's entity type, whether each clause applies.
 */

const INFORMATIONAL = /^(short title|applicability|definitions?|repeal|commencement)/i;
const DEONTIC = /\bshall\b(?! be called| come into force| apply| be reckoned| mean)|\bshall not\b|\bmust\b/i;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function scopeFromText(text: string): EntityType[] | null {
  const t = text.toLowerCase();
  if (/upper layer/.test(t) && !/middle layer/.test(t) && !/co-operative/.test(t)) return ["NBFC-UL"];
  if (/scheduled commercial bank/.test(t)) return ["SCB"];
  return null;
}

export function parseEffectiveDate(text: string): string | undefined {
  const m = text.match(/come into force on ([A-Z][a-z]+) (\d{1,2}), (\d{4})/);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (!month) return undefined;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export function defaultScope(text: string): EntityType[] {
  const t = text.toLowerCase();
  const scope: EntityType[] = [];
  if (/urban\)? co-operative bank/.test(t)) scope.push("UCB");
  if (/middle layer/.test(t)) scope.push("NBFC-ML");
  if (/upper layer/.test(t)) scope.push("NBFC-UL");
  if (/scheduled commercial bank/.test(t)) scope.push("SCB");
  return scope.length ? scope : ["UCB"];
}

export function segment(circularRef: string, text: string, entity: EntityType) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const paras: { number: string; heading?: string; text: string }[] = [];
  let current: { number: string; heading?: string; text: string } | null = null;
  let parentNum = "";
  let parentHeading = "";

  for (const line of lines) {
    const top = line.match(/^(\d+)\.\s+([^.]+)\.\s*(.*)$/);
    const sub = line.match(/^\(([a-z])\)\s+(.*)$/);
    if (top) {
      parentNum = top[1];
      parentHeading = top[2].trim();
      current = { number: top[1], heading: parentHeading, text: top[3].trim() };
      paras.push(current);
    } else if (sub && parentNum) {
      // A heading-only parent (e.g. "4. Exposure limits.") is replaced by its sub-paragraphs.
      const last = paras[paras.length - 1];
      if (last && last.number === parentNum && !last.text) paras.pop();
      current = { number: `${parentNum}(${sub[1]})`, heading: parentHeading, text: sub[2].trim() };
      paras.push(current);
    } else if (line && current && !/^(yours faithfully|\(.*signatory|chief general manager)/i.test(line)) {
      if (/^[A-Z][a-z]+ ?\/ ?Sir|^Madam/.test(line)) continue;
      current.text = current.text ? `${current.text} ${line}` : line;
    } else if (/^yours faithfully/i.test(line)) {
      current = null;
    }
  }

  const applicabilityPara = paras.find((p) => /^applicability/i.test(p.heading ?? ""));
  const baseScope = applicabilityPara ? defaultScope(applicabilityPara.text) : (["UCB"] as EntityType[]);
  const effective = paras.map((p) => parseEffectiveDate(p.text)).find(Boolean);
  const slug = circularRef.replace(/[^0-9]/g, "").slice(-3) || "000";

  const clauses: Clause[] = paras
    .filter((p) => p.text)
    .map((p) => {
      const id = `CL-${slug}-${p.number.replace(/[()]/g, "")}`;
      const scope = scopeFromText(p.text) ?? baseScope;
      let applicability: Clause["applicability"];
      let reason: string;
      if (INFORMATIONAL.test(p.heading ?? "")) {
        applicability = "informational";
        reason = `${p.heading}: no operative obligation`;
      } else if (!scope.includes(entity)) {
        applicability = "not_applicable";
        reason = `Applies to ${scope.join(", ")} only; bank is ${entity}`;
      } else if (!DEONTIC.test(p.text)) {
        applicability = "informational";
        reason = "No obligation verb (shall, shall not, must)";
      } else {
        applicability = "applies";
        reason = `Scope ${scope.join(", ")} includes ${entity}`;
      }
      return { id, number: p.number, heading: p.heading, text: p.text, applicability, reason, scope };
    });

  return { clauses, effectiveFrom: effective ?? "unspecified", baseScope };
}

export async function runReader(ctx: NiyamContext, tools: AgentTools) {
  const circ = await tools.call<{ ref: string; untrusted_text: string }>("kg_read_circular");
  const profile = await tools.call<{ entityType: EntityType }>("sm_bank_profile");
  const { clauses, effectiveFrom } = segment(circ.ref, circ.untrusted_text, profile.entityType);
  await tools.call("kg_write_clauses", {
    clauses: clauses.map(({ id, number, text, applicability, reason }) => ({ id, number, text, applicability, reason })),
  });
  ctx.clauses = clauses;
  return { clauses, effectiveFrom };
}
