import { runEval, type EvalReport } from "@/niyam/eval/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

let cached: Promise<EvalReport> | null = null;

export async function GET() {
  if (!cached) {
    cached = runEval();
    // Do not keep a failed run cached.
    cached.catch(() => {
      cached = null;
    });
  }
  try {
    return Response.json(await cached);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
