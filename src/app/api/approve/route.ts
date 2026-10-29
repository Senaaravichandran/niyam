import { APPROVERS, issueToken } from "@/niyam/approvals/token";
import { parseRule } from "@/niyam/dsl/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign the approval pack as one named approver. Each rule gets its own token, bound to the
 * SHA-256 of that rule's YAML. In the demo the approvers are SYNTHETIC identities; a bank would
 * put this behind its SSO and the approver's own credential.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    approverId?: string;
    drafts?: { ruleId: string; version: number; yaml: string }[];
  } | null;
  const approver = APPROVERS.find((a) => a.id === body?.approverId);
  if (!approver) return Response.json({ error: "Unknown approver" }, { status: 400 });
  if (!body?.drafts?.length || body.drafts.length > 10) return Response.json({ error: "drafts are required" }, { status: 400 });

  const tokens = [];
  for (const d of body.drafts) {
    try {
      const rule = parseRule(d.yaml);
      if (rule.rule_id !== d.ruleId) throw new Error("rule_id mismatch");
    } catch (e) {
      return Response.json({ error: `${d.ruleId}: ${(e as Error).message}` }, { status: 400 });
    }
    const t = issueToken({ rule_id: d.ruleId, version: d.version, yaml: d.yaml }, approver);
    tokens.push({ ruleId: d.ruleId, token: t.token, payload: t.payload });
  }
  return Response.json({ approver, tokens });
}
