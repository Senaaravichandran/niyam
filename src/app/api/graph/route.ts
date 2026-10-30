import { createContext } from "@/niyam/context";
import { runProposal } from "@/niyam/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface GraphPayload {
  nodes: { id: string; label: string; props: Record<string, unknown> }[];
  edges: { from: string; to: string; type: string; props: Record<string, unknown> }[];
  stats: { nodes: number; edges: number; labels: Record<string, number> };
  synthetic: true;
  circularRef: string;
}

const MAX_STRING = 2000;

/** Keep the payload small: long strings are cut, nested values pass through. */
function trimProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    out[k] = typeof v === "string" && v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}…` : v;
  }
  return out;
}

async function build(): Promise<GraphPayload> {
  const ctx = await createContext({ runId: "RUN-GRAPH" });
  await runProposal(ctx);
  const snap = ctx.graph.snapshot();
  return {
    nodes: snap.nodes.map((n) => ({ id: n.id, label: n.label, props: trimProps(n.props) })),
    edges: snap.edges.map((e) => ({ from: e.from, to: e.to, type: e.type, props: trimProps(e.props) })),
    stats: ctx.graph.stats(),
    synthetic: true,
    circularRef: ctx.circular.ref,
  };
}

// The synthetic run is deterministic, so one build serves every request for the life of the process.
let cached: Promise<GraphPayload> | null = null;

export async function GET() {
  if (!cached) {
    cached = build();
    cached.catch(() => {
      cached = null;
    });
  }
  try {
    return Response.json(await cached, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
