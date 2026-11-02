import { createContext } from "@/niyam/context";
import { llmAvailable } from "@/niyam/llm/claude";
import { runProposal } from "@/niyam/pipeline";
import { circularFrom, profileFor } from "@/niyam/inputs";
import { cleanCustomBank, type CustomBankInput } from "@/niyam/data/banks";
import { allowLlm, allowRequest, clientIp, readJson, sseStream, tooMany } from "../_lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Phase 1: stream the run from circular to approval pack. */
export async function POST(req: Request) {
  if (!allowRequest(clientIp(req))) return tooMany();
  const parsed = await readJson<{ path?: string; pace?: boolean; entityType?: string; bank?: string; customBank?: unknown; circular?: { ref?: string; title?: string; text?: string; synthetic?: boolean } }>(req, 30_000);
  if (!parsed.ok) return parsed.res;
  const body = parsed.value ?? {};
  let circular;
  try {
    circular = circularFrom(body.circular);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  let customBank: CustomBankInput | undefined;
  if (body.bank === "custom") {
    const c = cleanCustomBank(body.customBank);
    if (typeof c === "string") return Response.json({ error: c }, { status: 400 });
    customBank = c;
  }
  const profile = profileFor(body.entityType, body.bank, customBank);
  let path: "rule-based" | "llm" = body.path === "llm" ? "llm" : "rule-based";
  let note: string | undefined;
  if (path === "llm") {
    if (!llmAvailable()) note = "No ANTHROPIC_API_KEY on this deployment; the rule-based path ran instead.";
    else if (!allowLlm(clientIp(req))) {
      path = "rule-based";
      note = "LLM rate limit reached for your address; the rule-based path ran instead.";
    }
  }
  return sseStream(
    async (emit) => {
      if (note) emit({ type: "log", level: "warn", text: note });
      const ctx = await createContext({ path, emit, circular, profile, bank: body.bank, customBank });
      await runProposal(ctx);
    },
    { pace: body.pace !== false },
  );
}
