import type { RunEvent } from "@/niyam/events";

/** Presentation pacing so a person can follow the run. Durations shown in the UI are measured, not paced. */
const PACE_MS: Partial<Record<RunEvent["type"], number>> = {
  step: 260,
  a2a: 90,
  objection: 900,
  draft: 260,
  tests: 300,
  clauses: 300,
  obligations: 300,
  mapping: 300,
  backtest: 400,
  rollout: 260,
  day: 240,
  rollback: 900,
  thread: 200,
  guardrail: 220,
};

export function sseStream(run: (emit: (e: RunEvent) => void) => Promise<unknown>, opts: { pace: boolean }) {
  const encoder = new TextEncoder();
  const queue: RunEvent[] = [];
  let finished = false;
  let wake: (() => void) | null = null;
  const push = (e: RunEvent) => {
    queue.push(e);
    wake?.();
  };

  const stream = new ReadableStream({
    async start(controller) {
      run(push)
        .catch((err) => push({ type: "error", message: publicMessage(err) }))
        .finally(() => {
          finished = true;
          wake?.();
        });

      const send = (e: RunEvent) => controller.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      while (true) {
        if (!queue.length) {
          if (finished) break;
          await new Promise<void>((r) => (wake = r));
          wake = null;
          continue;
        }
        const e = queue.shift()!;
        send(e);
        const isRunning = e.type === "step" && e.status === "running";
        const delay = opts.pace ? (isRunning ? 120 : (PACE_MS[e.type] ?? 0)) : 0;
        if (delay) await new Promise((r) => setTimeout(r, delay));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Errors we raise on purpose are safe to show; anything else becomes a generic message. */
export function publicMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/^(Bundle|Refused|Deploy refused|Promotion refused|Rule is invalid|No backtest forecast|NIYAM_)/.test(m)) return m;
  console.error("[niyam] run failed:", err);
  return "The run failed on the server. Nothing was deployed. Please try again.";
}

const general = new Map<string, number[]>();
/** Best-effort per-instance limiter for every expensive endpoint. */
export function allowRequest(ip: string, perWindow = 30, windowMs = 10 * 60_000) {
  const now = Date.now();
  const recent = (general.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= perWindow) return false;
  recent.push(now);
  general.set(ip, recent);
  if (general.size > 5000) for (const [k, v] of general) if (!v.some((t) => now - t < windowMs)) general.delete(k);
  return true;
}

export const tooMany = () => Response.json({ error: "Too many requests from your address. Please wait a few minutes." }, { status: 429 });

/** Read a request body with a hard size cap before parsing. */
export async function readJson<T>(req: Request, max: number): Promise<{ ok: true; value: T } | { ok: false; res: Response }> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > max) return { ok: false, res: Response.json({ error: "Payload too large" }, { status: 413 }) };
  const text = await req.text();
  if (text.length > max) return { ok: false, res: Response.json({ error: "Payload too large" }, { status: 413 }) };
  try {
    return { ok: true, value: (text ? JSON.parse(text) : {}) as T };
  } catch {
    return { ok: false, res: Response.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
}

/** Best-effort per-instance limiter for the paid LLM path. */
const hits = new Map<string, number[]>();
export function allowLlm(ip: string, perWindow = 4, windowMs = 10 * 60_000) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= perWindow) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export function clientIp(req: Request) {
  const raw = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  // Group IPv6 clients by /64 so rotating addresses inside one network share a budget.
  return raw.includes(":") ? raw.split(":").slice(0, 4).join(":") : raw;
}
