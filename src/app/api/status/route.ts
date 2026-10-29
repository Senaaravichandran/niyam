import { usingDevSecret } from "@/niyam/approvals/token";
import { LLM_MODEL, llmAvailable } from "@/niyam/llm/claude";
import { ENGINE_LABEL } from "@/niyam/sql/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    llm: { available: llmAvailable(), model: LLM_MODEL },
    engine: ENGINE_LABEL,
    approvalSecret: usingDevSecret() ? "development secret" : "configured",
    a2aProtocolVersion: "1.0",
    synthetic: true,
  });
}
