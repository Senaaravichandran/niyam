import { createContext } from "@/niyam/context";
import type { ReleaseBundle } from "@/niyam/events";
import { runRelease } from "@/niyam/pipeline";
import { allowRequest, clientIp, readJson, sseStream, tooMany } from "../_lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Phase 2: verify approvals, promote, roll out under Sentinel watch, roll back on drift. */
export async function POST(req: Request) {
  if (!allowRequest(clientIp(req))) return tooMany();
  const parsed = await readJson<{
    bundle?: ReleaseBundle;
    tokens?: Record<string, string[]>;
    injectDrift?: boolean;
    pace?: boolean;
  }>(req, 400_000);
  if (!parsed.ok) return parsed.res;
  const body = parsed.value;
  if (!body?.bundle?.drafts?.length || body.bundle.drafts.length > 10 || !body.tokens || typeof body.tokens !== "object") {
    return Response.json({ error: "bundle and tokens are required" }, { status: 400 });
  }
  return sseStream(
    async (emit) => {
      const ctx = await createContext({ emit, runId: body.bundle!.runId, path: body.bundle!.path });
      await runRelease(ctx, { bundle: body.bundle!, tokens: body.tokens!, injectDrift: body.injectDrift !== false });
    },
    { pace: body.pace !== false },
  );
}
