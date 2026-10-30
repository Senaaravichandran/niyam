import { AGENTS, buildCard, type AgentId } from "@/niyam/a2a/cards";
import { handleRpc, toolsFor, closeTools } from "@/niyam/a2a/runtime";
import { RPC_ERRORS } from "@/niyam/a2a/types";
import { runExtractor } from "@/niyam/agents/extractor";
import { runMapper } from "@/niyam/agents/mapper";
import { runReader } from "@/niyam/agents/reader";
import { createContext } from "@/niyam/context";
import { registerSkills } from "@/niyam/pipeline";
import { allowRequest, clientIp, tooMany } from "../../_lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function baseUrl(req: Request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto}://${host}`;
}

const isAgent = (a: string): a is AgentId => AGENTS.some((x) => x.id === a);

export async function GET(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!isAgent(agent)) return Response.json({ error: "Unknown agent" }, { status: 404 });
  return Response.json(buildCard(agent, baseUrl(req)));
}

/**
 * Public A2A JSON-RPC endpoint. Each call runs on a fresh context seeded with the synthetic
 * circular; the agents that need earlier stages (Mapper, Author, Validator) have them prepared.
 */
export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!isAgent(agent)) return Response.json({ error: "Unknown agent" }, { status: 404 });
  if (!allowRequest(clientIp(req), 40)) return tooMany();
  if (Number(req.headers.get("content-length") ?? "0") > 100_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  const text = await req.text();
  if (text.length > 100_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: RPC_ERRORS.parse, message: "Parse error" } });
  }
  if (agent === "release") {
    return Response.json({
      jsonrpc: "2.0",
      id: (body as { id?: unknown })?.id ?? null,
      error: { code: RPC_ERRORS.unsupportedOperation, message: "Release only acts on a signed approval pack; run it from /console" },
    });
  }

  registerSkills();
  const ctx = await createContext({ runId: `PUBLIC-${Date.now().toString(36)}` });
  try {
    if (["mapper", "author", "validator"].includes(agent)) {
      const r = await runReader(ctx, toolsFor(ctx, "reader"));
      await runExtractor(ctx, toolsFor(ctx, "extractor"), r.effectiveFrom);
    }
    if (agent === "author") await runMapper(ctx, toolsFor(ctx, "mapper"));
    if (agent === "validator") await runMapper(ctx, toolsFor(ctx, "mapper"));
    const res = await handleRpc(agent, body, ctx, { global: true });
    return Response.json(res);
  } finally {
    await closeTools(ctx);
  }
}
