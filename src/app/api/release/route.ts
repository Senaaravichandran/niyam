import { createContext } from "@/niyam/context";
import type { ReleaseBundle } from "@/niyam/events";
import { runRelease } from "@/niyam/pipeline";
import { sseStream } from "../_lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Phase 2: verify approvals, promote, roll out under Sentinel watch, roll back on drift. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    bundle?: ReleaseBundle;
    tokens?: Record<string, string[]>;
    injectDrift?: boolean;
    pace?: boolean;
  } | null;
  if (!body?.bundle?.drafts?.length || !body.tokens) {
    return Response.json({ error: "bundle and tokens are required" }, { status: 400 });
  }
  if (JSON.stringify(body).length > 400_000) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  return sseStream(
    async (emit) => {
      const ctx = await createContext({ emit, runId: body.bundle!.runId, path: body.bundle!.path });
      await runRelease(ctx, { bundle: body.bundle!, tokens: body.tokens!, injectDrift: body.injectDrift !== false });
    },
    { pace: body.pace !== false },
  );
}
