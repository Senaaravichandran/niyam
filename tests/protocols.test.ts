import { describe, expect, it } from "vitest";
import { buildCard, AGENTS } from "@/niyam/a2a/cards";
import { handleRpc } from "@/niyam/a2a/runtime";
import { createContext } from "@/niyam/context";
import { ALLOWLIST } from "@/niyam/mcp/allowlist";
import { AgentTools, ToolDeniedError } from "@/niyam/mcp/client";
import { registerSkills } from "@/niyam/pipeline";

describe("A2A", () => {
  it("publishes a v1.0 Agent Card per agent with its MCP allowlist", () => {
    for (const a of AGENTS) {
      const card = buildCard(a.id, "https://example.test");
      expect(card.supportedInterfaces[0]).toEqual({ url: `https://example.test/a2a/${a.id}`, protocolBinding: "JSONRPC", protocolVersion: "1.0" });
      expect(card.skills.length).toBeGreaterThan(0);
      expect(card.capabilities.extensions?.[0].params.tools).toEqual(ALLOWLIST[a.id]);
    }
  });

  it("answers SendMessage, accepts the v0.3 alias, and rejects unknown methods", async () => {
    registerSkills();
    const ctx = await createContext();
    const msg = {
      messageId: "m-1",
      role: "ROLE_USER",
      parts: [{ data: { skill: "extract-obligations", input: { clause: { number: "4(b)", text: "A regulated entity shall flag for report any group of connected counterparties with an aggregate exposure exceeding 12 per cent of Tier 1 capital." } } } }],
    };
    for (const method of ["SendMessage", "message/send"]) {
      const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 1, method, params: { message: msg } }, ctx);
      expect(res.result.task.status.state).toBe("TASK_STATE_COMPLETED");
      const obs = res.result.task.artifacts[0].parts[0].data.obligations;
      expect(obs[0].operator).toBe(">");
      expect(obs[0].threshold).toBe(12);
    }
    const bad = await handleRpc("extractor", { jsonrpc: "2.0", id: 2, method: "tasks/delete" }, ctx);
    expect(bad.error?.code).toBe(-32601);
    const invalid = await handleRpc("extractor", { id: 3 }, ctx);
    expect(invalid.error?.code).toBe(-32600);
  });
});

describe("MCP allowlists", () => {
  it("refuses a tool outside the agent's allowlist on the client", async () => {
    const ctx = await createContext();
    const tools = new AgentTools(ctx, "extractor");
    await expect(tools.call("deploy_set_mode", {})).rejects.toBeInstanceOf(ToolDeniedError);
    await tools.close();
  });

  it("refuses it again on the server when the client check is bypassed", async () => {
    const ctx = await createContext();
    const tools = new AgentTools(ctx, "author");
    const res = await tools.probeServerSide("deploy_rollback", { rule_id: "SYN-EXP-012", to_version: 1, reason: "x" });
    expect(res.isError).toBe(true);
    expect(res.body.error).toMatch(/DENIED/);
    await tools.close();
  });

  it("lets the Author write only to draft branches", async () => {
    const ctx = await createContext();
    await expect(ctx.repo.commitDraft("main", "x.yaml", "x", "m")).rejects.toThrow(/draft\/\*/);
  });
});
