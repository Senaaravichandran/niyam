import { APPROVERS, issueToken, verifyPack } from "@/niyam/approvals/token";
import { parseRule } from "@/niyam/dsl/schema";
import type { ReleaseBundle } from "@/niyam/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 400_000;

/**
 * Sign an approval pack as one named approver. Only packs this server produced and signed are
 * accepted, unchanged; each rule gets its own token, bound to the run and to the SHA-256 of that
 * rule's YAML. The approvers are SYNTHETIC identities; a bank would put this behind its SSO.
 */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY) return Response.json({ error: "Payload too large" }, { status: 413 });
  let body: { approverId?: string; bundle?: ReleaseBundle } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const approver = APPROVERS.find((a) => a.id === body?.approverId);
  if (!approver) return Response.json({ error: "Unknown approver" }, { status: 400 });
  const bundle = body?.bundle;
  if (!bundle?.drafts?.length || bundle.drafts.length > 10) return Response.json({ error: "A signed approval pack is required" }, { status: 400 });

  const pack = verifyPack(bundle);
  if (!pack.ok) return Response.json({ error: pack.reason }, { status: 409 });

  const tokens = [];
  for (const d of bundle.drafts) {
    try {
      const rule = parseRule(d.yaml);
      if (rule.rule_id !== d.ruleId || rule.version !== d.version) throw new Error("id or version does not match the file");
    } catch (e) {
      return Response.json({ error: `${d.ruleId}: ${(e as Error).message}` }, { status: 400 });
    }
    const t = issueToken({ rule_id: d.ruleId, version: d.version, yaml: d.yaml }, approver, undefined, bundle.runId);
    tokens.push({ ruleId: d.ruleId, token: t.token, payload: t.payload });
  }
  return Response.json({ approver, tokens });
}
