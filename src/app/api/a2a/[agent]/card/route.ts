import { AGENTS, buildCard, type AgentId } from "@/niyam/a2a/cards";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!AGENTS.some((a) => a.id === agent)) return Response.json({ error: "Unknown agent" }, { status: 404 });
  const u = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${u.protocol}//${u.host}`;
  return Response.json(buildCard(agent as AgentId, base), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
  });
}
