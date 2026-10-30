import crypto from "node:crypto";
import type { NiyamContext } from "../context";
import { AgentTools } from "../mcp/client";
import { agentDef, type AgentId } from "./cards";
import {
  METHOD_ALIASES,
  RPC_ERRORS,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type Message,
  type Task,
  type TaskState,
} from "./types";

/**
 * A2A runtime. Every agent is reachable through one JSON-RPC handler. Inside a run, agents call
 * each other through `A2AClient.send`, which builds a real JSON-RPC envelope, serialises it, and
 * hands the bytes to the target's handler (loopback transport). Over HTTP the same handler serves
 * /a2a/{agent}. Agents never share function calls, only A2A messages.
 */

export interface SkillResult {
  data: unknown;
  text: string;
  state?: TaskState;
}

export type SkillHandler = (ctx: NiyamContext, input: any, env: { tools: AgentTools; a2a: A2AClient; taskId: string }) => Promise<SkillResult>;

const registry = new Map<string, SkillHandler>();

export function registerSkill(agent: AgentId, skill: string, fn: SkillHandler) {
  registry.set(`${agent}/${skill}`, fn);
}

const toolCache = new WeakMap<NiyamContext, Map<string, AgentTools>>();
export function toolsFor(ctx: NiyamContext, agent: string): AgentTools {
  let m = toolCache.get(ctx);
  if (!m) toolCache.set(ctx, (m = new Map()));
  let t = m.get(agent);
  if (!t) m.set(agent, (t = new AgentTools(ctx, agent)));
  return t;
}

export async function closeTools(ctx: NiyamContext) {
  const m = toolCache.get(ctx);
  if (!m) return;
  for (const t of m.values()) await t.close();
  m.clear();
}

const taskStores = new WeakMap<NiyamContext, Map<string, Task>>();
const globalTasks = new Map<string, Task>();
function storeFor(ctx: NiyamContext) {
  let s = taskStores.get(ctx);
  if (!s) taskStores.set(ctx, (s = new Map()));
  return s;
}

const rpcError = (id: JsonRpcRequest["id"], code: number, message: string, data?: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
});

function extractSkillInput(msg: Message, agent: AgentId) {
  const dataPart = msg.parts.find((p) => p.data !== undefined);
  const textPart = msg.parts.find((p) => p.text !== undefined);
  const data = (dataPart?.data ?? {}) as Record<string, unknown>;
  const skill =
    (msg.metadata?.skill as string | undefined) ??
    (data.skill as string | undefined) ??
    agentDef(agent)?.skills[0]?.id;
  const input = (data.input as unknown) ?? (dataPart ? data : textPart ? { text: textPart.text } : {});
  return { skill: skill!, input };
}

function safeError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/^(Rule is invalid|Refused|DENIED|No (work item|obligation)|A2A |Unknown|Bundle|Deploy refused|Promotion refused|Agent )/.test(m) || / failed /.test(m)) return m;
  console.error("[niyam] task failed:", e);
  return "The task failed inside the agent";
}

export async function handleRpc(agent: AgentId, raw: unknown, ctx: NiyamContext, opts: { global?: boolean } = {}): Promise<JsonRpcResponse> {
  const req = raw as JsonRpcRequest;
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return rpcError(req?.id ?? null, RPC_ERRORS.invalidRequest, "Invalid JSON-RPC 2.0 request");
  }
  const method = METHOD_ALIASES[req.method] ?? req.method;
  const store = opts.global ? globalTasks : storeFor(ctx);

  if (method === "GetTask") {
    const t = store.get(req.params?.id);
    return t ? { jsonrpc: "2.0", id: req.id, result: t } : rpcError(req.id, RPC_ERRORS.taskNotFound, "Task not found");
  }
  if (method === "CancelTask") {
    const t = store.get(req.params?.id);
    if (!t) return rpcError(req.id, RPC_ERRORS.taskNotFound, "Task not found");
    return rpcError(req.id, RPC_ERRORS.taskNotCancelable, `Task is ${t.status.state}`);
  }
  if (method !== "SendMessage") {
    return rpcError(req.id, RPC_ERRORS.methodNotFound, `Method ${req.method} not supported; use SendMessage, GetTask or CancelTask`);
  }

  const msg = req.params?.message as Message | undefined;
  if (
    !msg ||
    typeof msg.messageId !== "string" ||
    !Array.isArray(msg.parts) ||
    msg.parts.length > 20 ||
    !msg.parts.every((p) => p && typeof p === "object")
  ) {
    return rpcError(req.id, RPC_ERRORS.invalidParams, "params.message with messageId and parts is required");
  }
  const { skill, input } = extractSkillInput(msg, agent);
  const handler = registry.get(`${agent}/${skill}`);
  if (!handler) return rpcError(req.id, RPC_ERRORS.invalidParams, `Agent ${agent} has no skill "${skill}"`);

  const task: Task = {
    id: `task-${crypto.randomUUID()}`,
    contextId: msg.contextId ?? ctx.runId,
    status: { state: "TASK_STATE_WORKING", timestamp: new Date().toISOString() },
    artifacts: [],
    history: [msg],
    metadata: { agent, skill },
  };
  store.set(task.id, task);
  const cap = opts.global ? 200 : 500;
  while (store.size > cap) store.delete(store.keys().next().value!);

  try {
    const res = await handler(ctx, input, { tools: toolsFor(ctx, agent), a2a: new A2AClient(ctx, agent), taskId: task.id });
    const reply: Message = {
      messageId: crypto.randomUUID(),
      role: "ROLE_AGENT",
      parts: [{ text: res.text }],
      contextId: task.contextId,
      taskId: task.id,
    };
    task.history.push(reply);
    task.artifacts.push({
      artifactId: `${task.id}-out`,
      name: `${skill}-result`,
      parts: [{ data: res.data, mediaType: "application/json" }],
    });
    task.status = { state: res.state ?? "TASK_STATE_COMPLETED", timestamp: new Date().toISOString(), message: reply };
    // Public tasks keep a short history only; the full artifact is returned once, in this response.
    if (opts.global) {
      const full = structuredClone(task);
      task.history = [reply];
      task.artifacts = task.artifacts.map((a) => ({ ...a, parts: [{ text: "Artifact returned in the original response" }] }));
      return { jsonrpc: "2.0", id: req.id, result: { task: full } };
    }
  } catch (e) {
    const reply: Message = {
      messageId: crypto.randomUUID(),
      role: "ROLE_AGENT",
      parts: [{ text: safeError(e) }],
      contextId: task.contextId,
      taskId: task.id,
    };
    task.status = { state: "TASK_STATE_FAILED", timestamp: new Date().toISOString(), message: reply };
  }
  return { jsonrpc: "2.0", id: req.id, result: { task } };
}

export class A2AClient {
  constructor(private ctx: NiyamContext, private from: string) {}

  /** Send a task to another agent. Returns the completed task and its first data artifact. */
  async send<T = any>(to: AgentId, skill: string, input: unknown, opts: { referenceTaskIds?: string[]; summary?: string } = {}) {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "SendMessage",
      params: {
        message: {
          messageId: crypto.randomUUID(),
          role: "ROLE_USER",
          contextId: this.ctx.runId,
          referenceTaskIds: opts.referenceTaskIds,
          metadata: { skill, from: `niyam-${this.from}` },
          parts: [{ data: { skill, input }, mediaType: "application/json" }],
        } satisfies Message,
      },
    };
    // Wire fidelity: the target only ever sees what survives JSON serialisation.
    const wire = JSON.parse(JSON.stringify(request));
    this.ctx.emit({ type: "a2a", from: this.from, to, method: "SendMessage", skill, taskId: "pending", state: "TASK_STATE_SUBMITTED", summary: opts.summary ?? skill });
    const response = await handleRpc(to, wire, this.ctx);
    if (response.error) throw new Error(`A2A ${to}/${skill}: ${response.error.message}`);
    const task = response.result.task as Task;
    const text = task.status.message?.parts.find((p) => p.text)?.text ?? "";
    this.ctx.emit({ type: "a2a", from: to, to: this.from, method: "SendMessage", skill, taskId: task.id, state: task.status.state, summary: text });
    if (task.status.state === "TASK_STATE_FAILED") throw new Error(`${to} failed ${skill}: ${text}`);
    const data = task.artifacts[0]?.parts[0]?.data as T;
    return { task, data, text };
  }
}
