import { beforeAll, describe, expect, it } from "vitest";
import { handleRpc } from "@/niyam/a2a/runtime";
import { RPC_ERRORS } from "@/niyam/a2a/types";
import { createContext, type NiyamContext } from "@/niyam/context";
import { registerSkills } from "@/niyam/pipeline";

const message = (skill: string) => ({
  messageId: `m-${skill}`,
  role: "ROLE_USER",
  parts: [
    {
      data: {
        skill,
        input: {
          clause: {
            number: "4(b)",
            text: "A regulated entity shall flag for report any group of connected counterparties with an aggregate exposure exceeding 12 per cent of Tier 1 capital.",
          },
        },
      },
    },
  ],
});

let ctx: NiyamContext;
beforeAll(async () => {
  registerSkills();
  ctx = await createContext();
});

async function sendExtract() {
  const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: message("extract-obligations") } }, ctx);
  expect(res.error).toBeUndefined();
  return res.result.task;
}

describe("A2A runtime task store", () => {
  it("GetTask returns the task stored by SendMessage", async () => {
    const task = await sendExtract();
    const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 2, method: "GetTask", params: { id: task.id } }, ctx);
    expect(res.error).toBeUndefined();
    expect(res.id).toBe(2);
    expect(res.result.id).toBe(task.id);
    expect(res.result.status.state).toBe("TASK_STATE_COMPLETED");
  });

  it("GetTask on an unknown id returns task-not-found", async () => {
    const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 3, method: "GetTask", params: { id: "task-nope" } }, ctx);
    expect(res.error?.code).toBe(RPC_ERRORS.taskNotFound);
  });

  it("GetTask does not leak tasks across run contexts", async () => {
    const task = await sendExtract();
    const other = await createContext();
    const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 4, method: "GetTask", params: { id: task.id } }, other);
    expect(res.error?.code).toBe(RPC_ERRORS.taskNotFound);
  });

  it("CancelTask on a completed task returns -32002 (not cancelable)", async () => {
    const task = await sendExtract();
    const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 5, method: "CancelTask", params: { id: task.id } }, ctx);
    expect(res.error?.code).toBe(-32002);
    expect(res.error?.message).toMatch(/COMPLETED/);
  });

  it("CancelTask on an unknown task returns -32001", async () => {
    const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 6, method: "CancelTask", params: { id: "task-nope" } }, ctx);
    expect(res.error?.code).toBe(-32001);
  });

  it("SendMessage naming an unknown skill returns -32602 (invalid params)", async () => {
    const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 7, method: "SendMessage", params: { message: message("no-such-skill") } }, ctx);
    expect(res.error?.code).toBe(-32602);
    expect(res.error?.message).toMatch(/no-such-skill/);
  });

  it("SendMessage without a messageId returns -32602", async () => {
    const res = await handleRpc("extractor", { jsonrpc: "2.0", id: 8, method: "SendMessage", params: { message: { role: "ROLE_USER", parts: [] } } }, ctx);
    expect(res.error?.code).toBe(-32602);
  });
});
