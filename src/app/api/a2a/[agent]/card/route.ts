import { AGENTS, buildCard, type AgentId } from "@/niyam/a2a/cards";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!AGENTS.some((a) => a.id === agent)) return Response.json({ error: "Unknown agent" }, { status: 404 });
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return Response.json(buildCard(agent as AgentId, `${proto}://${host}`), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
  });
}
