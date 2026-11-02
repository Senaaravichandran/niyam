import { ENTITY_LABEL, type BankProfile, type EntityType } from "./data/bankProfile";
import { bankByKey } from "./data/banks";
import { CIRCULAR, type CircularSource } from "./data/circular";

/**
 * Inputs a bank provides for a run: the circular it received and its own licence type.
 * Everything else (policies, live rules, loan book) is the bank's synthetic starting state.
 */
export const ENTITY_TYPES: EntityType[] = ["UCB", "NBFC-ML", "NBFC-UL", "SCB"];
export const MAX_CIRCULAR_CHARS = 20_000;

/** The chosen bank's profile; an explicit licence type that differs from the bank's overrides it. */
export function profileFor(entity?: string, bankKey?: string): BankProfile {
  const base = bankByKey(bankKey).profile;
  const e = (ENTITY_TYPES as string[]).includes(entity ?? "") ? (entity as EntityType) : base.entityType;
  if (e === base.entityType) return base;
  const name = e === "SCB" ? "Demo Commercial Bank (SYNTHETIC)" : e.startsWith("NBFC") ? `Demo ${ENTITY_LABEL[e]} (SYNTHETIC)` : base.name;
  return { ...base, entityType: e, name, tier: ENTITY_LABEL[e] };
}

/** A reference that is safe in rule files and branch names, e.g. "RBI-2019-20-171". */
export function safeRef(ref: string | undefined, fallback = "CIRC-UPLOAD-001") {
  const r = (ref ?? "").toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return /^[A-Z0-9][A-Z0-9-]{2,40}$/.test(r) ? r : fallback;
}

/**
 * An RBI circular's subject is the line after the salutation ("Madam / Sir,"). Without one, the
 * first line that is not a letterhead, reference or addressee.
 */
export function subjectOf(text: string): string | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sal = lines.findIndex((l) => /^(madam|dear sir|sir)\b/i.test(l));
  if (sal >= 0 && lines[sal + 1] && !/^\d{1,3}\./.test(lines[sal + 1])) return lines[sal + 1].slice(0, 160);
  return lines.find((l) => l.length > 12 && !/^(reserve bank|fictional|rbi\/|dor\.|dbr\.|all )/i.test(l) && !/^\d{1,3}\./.test(l))?.slice(0, 160);
}

export function circularFrom(input?: { ref?: string; title?: string; text?: string; synthetic?: boolean } | null): CircularSource {
  const text = (input?.text ?? "").replace(/\r\n/g, "\n").trim();
  if (!text || text === CIRCULAR.text.trim()) return CIRCULAR;
  if (text.length > MAX_CIRCULAR_CHARS) throw new Error(`Refused: the circular is longer than ${MAX_CIRCULAR_CHARS} characters`);
  const title = (input?.title ?? "").replace(/[\r\n]+/g, " ").slice(0, 160) || subjectOf(text) || "Uploaded circular";
  return {
    ref: safeRef(input?.ref),
    title,
    issuedOn: new Date().toISOString().slice(0, 10),
    issuer: "As uploaded by the bank",
    amends: "Not stated",
    synthetic: Boolean(input?.synthetic),
    text,
  };
}
