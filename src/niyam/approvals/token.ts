import crypto from "node:crypto";

/**
 * Two-person approval tokens.
 * A token is HMAC-SHA256 over {rule_id, version, sha256(rule file), approver, role, issued_at}.
 * Change one byte of the rule after signing and the hash no longer matches, so the token is void.
 */

export interface Approver {
  id: string;
  name: string;
  role: "Chief Compliance Officer" | "Head of Risk and IT Change";
  /** Maker prepares and reviews the change; checker independently authorises it. */
  duty: "Maker" | "Checker";
}

/** SYNTHETIC approvers for the demo. */
export const APPROVERS: Approver[] = [
  { id: "APR-CCO", name: "A. Menon", role: "Chief Compliance Officer", duty: "Maker" },
  { id: "APR-RISK", name: "R. Iyer", role: "Head of Risk and IT Change", duty: "Checker" },
];

/** What each approver must confirm they reviewed before signing. */
export const REVIEW_CHECKS = [
  "clause: I read the circular clause and the exact quoted words",
  "rule: The rule's number, operator and scope match the clause",
  "tests: All generated tests pass, including the boundary cases",
  "impact: I reviewed the 90-day backtest and the alert impact",
] as const;

/** The reviewer's own record, signed into the token. */
export interface Review {
  name: string;
  employeeId: string;
  reason: string;
  checks: string[];
}

/** Validates a review; returns an error message or the cleaned review. */
export function cleanReview(r: unknown): Review | string {
  const o = (r ?? {}) as Record<string, unknown>;
  // \s also covers U+2028 and U+2029, so every value stays on one line.
  const one = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const name = one(o.name, 60);
  const employeeId = one(o.employeeId, 20);
  const reason = one(o.reason, 500);
  const checks = Array.isArray(o.checks) ? o.checks.filter((c): c is string => typeof c === "string" && (REVIEW_CHECKS as readonly string[]).includes(c)) : [];
  if (name.length < 2) return "Enter the approver's full name";
  if (!/^[A-Za-z0-9-]{3,20}$/.test(employeeId)) return "Enter a valid employee ID (letters, digits, hyphen)";
  if (reason.length < 10) return "Give a reason for approving (at least 10 characters)";
  if (new Set(checks).size !== REVIEW_CHECKS.length) return "Tick every review check before signing";
  return { name, employeeId, reason, checks: [...REVIEW_CHECKS] };
}

export interface ApprovalPayload {
  run_id?: string;
  rule_id: string;
  version: number;
  rule_sha256: string;
  approver_id: string;
  approver_name: string;
  role: string;
  duty?: string;
  employee_id?: string;
  reason?: string;
  checks?: string[];
  issued_at: string;
}

export interface ApprovalToken {
  token: string;
  payload: ApprovalPayload;
}

const DEV_SECRET = "niyam-demo-secret-change-me";

export function approvalSecret() {
  const s = process.env.NIYAM_APPROVAL_SECRET;
  if (!s && process.env.VERCEL_ENV === "production") {
    throw new Error("NIYAM_APPROVAL_SECRET must be set in production");
  }
  return s || DEV_SECRET;
}

/** Tokens are valid for 24 hours. */
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function usingDevSecret() {
  return !process.env.NIYAM_APPROVAL_SECRET;
}

export function sha256(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function issueToken(
  rule: { rule_id: string; version: number; yaml: string },
  approver: Approver,
  issuedAt = new Date().toISOString(),
  runId?: string,
  review?: Review,
): ApprovalToken {
  const payload: ApprovalPayload = {
    ...(runId ? { run_id: runId } : {}),
    rule_id: rule.rule_id,
    version: rule.version,
    rule_sha256: sha256(rule.yaml),
    approver_id: approver.id,
    approver_name: review?.name ?? approver.name,
    role: approver.role,
    duty: approver.duty,
    ...(review ? { employee_id: review.employeeId, reason: review.reason, checks: review.checks } : {}),
    issued_at: issuedAt,
  };
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", approvalSecret()).update(body).digest("base64url");
  return { token: `${body}.${sig}`, payload };
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  payload?: ApprovalPayload;
}

export function verifyToken(token: string, ruleYaml: string, ruleId: string, runId?: string): VerifyResult {
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "Malformed token" };
  const expected = crypto.createHmac("sha256", approvalSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "Signature does not verify" };
  }
  let payload: ApprovalPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "Unreadable payload" };
  }
  if (payload.rule_id !== ruleId) return { ok: false, reason: `Token is for ${payload.rule_id}, not ${ruleId}`, payload };
  if (runId !== undefined && payload.run_id !== runId) {
    return { ok: false, reason: `Token was issued for another run (${payload.run_id ?? "none"})`, payload };
  }
  const age = Date.now() - Date.parse(payload.issued_at);
  if (!Number.isFinite(age) || age > TOKEN_TTL_MS || age < -5 * 60 * 1000) {
    return { ok: false, reason: "Token has expired or has an invalid issue time", payload };
  }
  const actual = sha256(ruleYaml);
  if (payload.rule_sha256 !== actual) {
    return {
      ok: false,
      reason: `Rule file changed after approval (signed ${payload.rule_sha256.slice(0, 12)}, now ${actual.slice(0, 12)})`,
      payload,
    };
  }
  return { ok: true, payload };
}

/** Maker-checker: two valid tokens from two different people in two different roles. */
export function verifyTwoPerson(tokens: string[], ruleYaml: string, ruleId: string, runId?: string) {
  if (tokens.length > 10) return { ok: false, reason: "Too many tokens", results: [] as VerifyResult[] };
  const results = tokens.map((t) => verifyToken(t, ruleYaml, ruleId, runId));
  const valid = results.filter((r) => r.ok);
  const people = new Set(valid.map((r) => r.payload!.approver_id));
  const roles = new Set(valid.map((r) => r.payload!.role));
  const names = new Set(valid.map((r) => r.payload!.approver_name.trim().toLowerCase()));
  let reason: string | undefined;
  if (valid.length < results.length) reason = results.find((r) => !r.ok)?.reason;
  else if (people.size < 2 || names.size < 2) reason = "Two different approvers are required";
  else if (roles.size < 2) reason = "Approvers must hold different roles";
  return { ok: !reason, reason, results };
}

/* ---------- approval pack signature ---------- */

/** JSON with sorted keys, so a pack signs the same whatever order its fields arrive in. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

export interface SignablePack {
  runId: string;
  circularRef: string;
  path: string;
  drafts: { ruleId: string; version: number; yaml: string; obligationId: string; kind: string; title: string }[];
  obligations: unknown[];
  mapping: unknown;
  impact: unknown;
  testsPassed: number;
  testsTotal: number;
  circular?: { ref: string; title: string; text: string; synthetic: boolean };
  entityType?: string;
  bankKey?: string;
}

function packBody(p: SignablePack) {
  return canonical({
    runId: p.runId,
    circularRef: p.circularRef,
    path: p.path,
    drafts: p.drafts.map((d) => ({ ruleId: d.ruleId, version: d.version, sha256: sha256(d.yaml), obligationId: d.obligationId, kind: d.kind, title: d.title })),
    obligations: p.obligations,
    mapping: p.mapping,
    impact: p.impact,
    testsPassed: p.testsPassed,
    testsTotal: p.testsTotal,
    circular: p.circular ? { ref: p.circular.ref, title: p.circular.title, sha256: sha256(p.circular.text), synthetic: p.circular.synthetic } : null,
    entityType: p.entityType ?? null,
    bankKey: p.bankKey ?? null,
  });
}

function packHmac(p: SignablePack) {
  return crypto.createHmac("sha256", approvalSecret()).update(`pack:${packBody(p)}`).digest("base64url");
}

/** The server signs every approval pack it produces; approvals and releases accept only signed packs. */
export function signPack(p: SignablePack): { signature: string; draftHashes: Record<string, string> } {
  return { signature: packHmac(p), draftHashes: Object.fromEntries(p.drafts.map((d) => [d.ruleId, sha256(d.yaml)])) };
}

export function verifyPack(p: SignablePack & { signature?: string; draftHashes?: Record<string, string> }): { ok: boolean; reason?: string } {
  if (!p || !Array.isArray(p.drafts) || !p.signature || !p.draftHashes) return { ok: false, reason: "Approval pack is not signed by this server" };
  for (const d of p.drafts) {
    const signed = p.draftHashes[d.ruleId];
    const now = sha256(String(d.yaml));
    if (!signed) return { ok: false, reason: `${d.ruleId} is not part of the signed approval pack` };
    if (signed !== now) return { ok: false, reason: `${d.ruleId}: Rule file changed after approval (signed ${signed.slice(0, 12)}, now ${now.slice(0, 12)})` };
  }
  const a = Buffer.from(String(p.signature));
  const b = Buffer.from(packHmac(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "Approval pack changed after it was signed (obligations, mapping or forecasts differ)" };
  }
  return { ok: true };
}
