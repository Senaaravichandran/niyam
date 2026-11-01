import { BANK_PROFILE, ENTITY_LABEL, type BankProfile, type EntityType } from "./data/bankProfile";
import { CIRCULAR, type CircularSource } from "./data/circular";

/**
 * Inputs a bank provides for a run: the circular it received and its own licence type.
 * Everything else (policies, live rules, loan book) is the bank's synthetic starting state.
 */
export const ENTITY_TYPES: EntityType[] = ["UCB", "NBFC-ML", "NBFC-UL", "SCB"];
export const MAX_CIRCULAR_CHARS = 20_000;

export function profileFor(entity?: string): BankProfile {
  const e = (ENTITY_TYPES as string[]).includes(entity ?? "") ? (entity as EntityType) : BANK_PROFILE.entityType;
  if (e === BANK_PROFILE.entityType) return BANK_PROFILE;
  const name = e === "SCB" ? "Demo Commercial Bank (SYNTHETIC)" : e.startsWith("NBFC") ? `Demo ${ENTITY_LABEL[e]} (SYNTHETIC)` : BANK_PROFILE.name;
  return { ...BANK_PROFILE, entityType: e, name, tier: ENTITY_LABEL[e] };
}

/** A reference that is safe in rule files and branch names, e.g. "RBI-2019-20-171". */
export function safeRef(ref: string | undefined, fallback = "CIRC-UPLOAD-001") {
  const r = (ref ?? "").toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return /^[A-Z0-9][A-Z0-9-]{2,40}$/.test(r) ? r : fallback;
}

export function circularFrom(input?: { ref?: string; title?: string; text?: string; synthetic?: boolean } | null): CircularSource {
  const text = (input?.text ?? "").replace(/\r\n/g, "\n").trim();
  if (!text || text === CIRCULAR.text.trim()) return CIRCULAR;
  if (text.length > MAX_CIRCULAR_CHARS) throw new Error(`Refused: the circular is longer than ${MAX_CIRCULAR_CHARS} characters`);
  const title = (input?.title ?? "").replace(/[\r\n]+/g, " ").slice(0, 160) || text.split("\n").find((l) => l.trim().length > 12)?.trim().slice(0, 160) || "Uploaded circular";
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
