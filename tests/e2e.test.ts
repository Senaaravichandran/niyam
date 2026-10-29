import { describe, expect, it } from "vitest";
import { createContext } from "@/niyam/context";
import { runProposal, runRelease } from "@/niyam/pipeline";
import { APPROVERS, issueToken } from "@/niyam/approvals/token";
import type { RunEvent } from "@/niyam/events";

describe("end to end: circular to live rule and back", () => {
  it("runs the whole pipeline on the synthetic circular", async () => {
    const events: RunEvent[] = [];
    const ctx = await createContext({ emit: (e) => events.push(e) });
    const bundle = await runProposal(ctx);

    // Reader and Extractor
    const applies = bundle.clauses.filter((c) => c.applicability === "applies").map((c) => c.number);
    expect(applies).toEqual(["4(a)", "4(b)", "4(c)", "5"]);
    expect(bundle.clauses.find((c) => c.number === "6")!.applicability).toBe("not_applicable");
    for (const o of bundle.obligations) {
      const clause = bundle.clauses.find((c) => c.id === o.clauseId)!;
      expect(clause.text.slice(o.spanStart, o.spanEnd)).toBe(o.span);
    }

    // Mapper: 2 modify, 1 gap, 1 conflict
    expect(bundle.mapping.modify.map((m) => m.ruleId).sort()).toEqual(["SYN-EXP-011", "SYN-EXP-012"]);
    expect(bundle.mapping.gaps.map((g) => g.proposedRuleId)).toEqual(["SYN-CON-020"]);
    expect(bundle.mapping.conflicts).toHaveLength(1);
    expect(bundle.mapping.conflicts[0].policyId).toBe("POL-CR-07-7.2");

    // Author's first draft carried ">=" over; the Validator objected over A2A; Author fixed it.
    const objection = events.find((e) => e.type === "objection");
    expect(objection && objection.type === "objection" && objection.objection.code).toContain("OP-FIDELITY");
    const a2aObjection = events.find((e) => e.type === "a2a" && e.from === "validator" && e.to === "author" && e.skill === "resolve-objection");
    expect(a2aObjection).toBeTruthy();
    const final012 = bundle.drafts.find((d) => d.ruleId === "SYN-EXP-012")!;
    expect(final012.yaml).toContain('op: ">"');
    expect(final012.yaml).not.toContain("unless");

    // 14/14 generated tests
    expect(bundle.testsTotal).toBe(14);
    expect(bundle.testsPassed).toBe(14);

    // Backtest
    expect(bundle.impact.days).toBe(90);
    expect(bundle.impact.newAlerts).toBeGreaterThan(bundle.impact.oldAlerts);

    // Release with two approvers and injected drift
    const tokens: Record<string, string[]> = {};
    for (const d of bundle.drafts) tokens[d.ruleId] = APPROVERS.map((a) => issueToken({ rule_id: d.ruleId, version: d.version, yaml: d.yaml }, a).token);
    const relEvents: RunEvent[] = [];
    const ctx2 = await createContext({ emit: (e) => relEvents.push(e) });
    const res = await runRelease(ctx2, { bundle, tokens, injectDrift: true });
    expect(res.ok).toBe(true);
    const modes = relEvents.filter((e) => e.type === "rollout").map((e) => (e.type === "rollout" ? e.state.mode : ""));
    expect(modes).toContain("shadow");
    expect(modes).toContain("canary");
    expect(modes).toContain("live");
    expect(res.rolledBack).toContain("SYN-EXP-012");
    expect(res.rolledBack).not.toContain("SYN-CON-020");

    // Golden Thread
    const thread = relEvents.find((e) => e.type === "thread");
    expect(thread && thread.type === "thread" && thread.thread.clause?.number).toBe("4(b)");
    expect(thread && thread.type === "thread" && thread.thread.approvals).toHaveLength(2);
  });

  it("rolls out without rollback when no drift is injected", async () => {
    const ctx = await createContext();
    const bundle = await runProposal(ctx);
    const tokens: Record<string, string[]> = {};
    for (const d of bundle.drafts) tokens[d.ruleId] = APPROVERS.map((a) => issueToken({ rule_id: d.ruleId, version: d.version, yaml: d.yaml }, a).token);
    const res = await runRelease(await createContext(), { bundle, tokens, injectDrift: false });
    expect(res.ok).toBe(true);
    expect(res.rolledBack).toEqual([]);
  });

  it("refuses to release a rule edited after approval", async () => {
    const ctx = await createContext();
    const bundle = await runProposal(ctx);
    const tokens: Record<string, string[]> = {};
    for (const d of bundle.drafts) tokens[d.ruleId] = APPROVERS.map((a) => issueToken({ rule_id: d.ruleId, version: d.version, yaml: d.yaml }, a).token);
    const tampered = { ...bundle, drafts: bundle.drafts.map((d) => (d.ruleId === "SYN-EXP-012" ? { ...d, yaml: d.yaml.replace("value: 12", "value: 13") } : d)) };
    const res = await runRelease(await createContext(), { bundle: tampered, tokens, injectDrift: false });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/changed after approval/);
  });
});
