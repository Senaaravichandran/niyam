import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { NiyamContext } from "../context";
import { allowedFor, TOOL_SERVER } from "./allowlist";
import { createToolServer, type ToolGroup } from "./servers";

export class ToolDeniedError extends Error {}

/**
 * An agent's handle on the tool layer. One MCP client per (agent, server), connected in-process
 * over a linked transport pair. Calls outside the agent's allowlist never leave the client.
 */
export class AgentTools {
  private clients = new Map<string, Client>();
  readonly allow: Set<string>;

  constructor(private ctx: NiyamContext, readonly agent: string) {
    this.allow = new Set(allowedFor(agent));
  }

  private async clientFor(group: string): Promise<Client> {
    let c = this.clients.get(group);
    if (c) return c;
    const server = createToolServer(this.ctx, group as ToolGroup, this.agent);
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await server.connect(serverT);
    c = new Client({ name: `niyam-${this.agent}`, version: "1.0.0" });
    await c.connect(clientT);
    this.clients.set(group, c);
    return c;
  }

  async call<T = any>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    const server = TOOL_SERVER[tool] ?? "unknown";
    const t0 = performance.now();
    if (!this.allow.has(tool)) {
      this.record({ at: Date.now(), agent: this.agent, server, tool, allowed: false, ms: 0, error: "not on allowlist" });
      throw new ToolDeniedError(`DENIED: ${this.agent} may not call ${tool} (not on its Agent Card allowlist)`);
    }
    const client = await this.clientFor(server);
    const res = await client.callTool({ name: tool, arguments: args });
    const ms = performance.now() - t0;
    const text = (res.content as { type: string; text: string }[])[0]?.text ?? "null";
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
    if (res.isError) {
      this.record({ at: Date.now(), agent: this.agent, server, tool, allowed: true, ms, error: data.error });
      throw new Error(data.error);
    }
    this.record({ at: Date.now(), agent: this.agent, server, tool, allowed: true, ms });
    return data as T;
  }

  /** Bypass the client-side check and ask the server directly, to prove the server enforces too. */
  async probeServerSide(tool: string, args: Record<string, unknown> = {}) {
    const server = TOOL_SERVER[tool];
    const client = await this.clientFor(server);
    const res = await client.callTool({ name: tool, arguments: args });
    const text = (res.content as { type: string; text: string }[])[0]?.text ?? "null";
    this.record({ at: Date.now(), agent: this.agent, server, tool, allowed: false, ms: 0, error: "server refused" });
    return { isError: !!res.isError, body: JSON.parse(text) };
  }

  private record(call: NiyamContext["mcpLog"][number]) {
    this.ctx.mcpLog.push(call);
    this.ctx.emit({ type: "mcp", call });
  }

  async close() {
    for (const c of this.clients.values()) await c.close();
    this.clients.clear();
  }
}
