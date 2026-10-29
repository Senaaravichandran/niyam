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
}

/** SYNTHETIC approvers for the demo. */
export const APPROVERS: Approver[] = [
  { id: "APR-CCO", name: "A. Menon", role: "Chief Compliance Officer" },
  { id: "APR-RISK", name: "R. Iyer", role: "Head of Risk and IT Change" },
];

export interface ApprovalPayload {
  rule_id: string;
  version: number;
  rule_sha256: string;
  approver_id: string;
  approver_name: string;
  role: string;
  issued_at: string;
}

export interface ApprovalToken {
  token: string;
  payload: ApprovalPayload;
}

const DEV_SECRET = "niyam-demo-secret-change-me";

export function approvalSecret() {
  return process.env.NIYAM_APPROVAL_SECRET || DEV_SECRET;
}

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
): ApprovalToken {
  const payload: ApprovalPayload = {
    rule_id: rule.rule_id,
    version: rule.version,
    rule_sha256: sha256(rule.yaml),
    approver_id: approver.id,
    approver_name: approver.name,
    role: approver.role,
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

export function verifyToken(token: string, ruleYaml: string, ruleId: string): VerifyResult {
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
export function verifyTwoPerson(tokens: string[], ruleYaml: string, ruleId: string) {
  const results = tokens.map((t) => verifyToken(t, ruleYaml, ruleId));
  const valid = results.filter((r) => r.ok);
  const people = new Set(valid.map((r) => r.payload!.approver_id));
  const roles = new Set(valid.map((r) => r.payload!.role));
  let reason: string | undefined;
  if (valid.length < results.length) reason = results.find((r) => !r.ok)?.reason;
  else if (people.size < 2) reason = "Two different approvers are required";
  else if (roles.size < 2) reason = "Approvers must hold different roles";
  return { ok: !reason, reason, results };
}
