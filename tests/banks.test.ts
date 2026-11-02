import { describe, expect, it } from "vitest";
import { createContext } from "@/niyam/context";
import { runProposal, runRelease } from "@/niyam/pipeline";
import { APPROVERS, issueToken } from "@/niyam/approvals/token";
import { BANKS } from "@/niyam/data/banks";
import type { RunEvent } from "@/niyam/events";

describe.each(BANKS.map((b) => [b.short, b] as const))("%s: its own circular end to end", (_name, bank) => {
  it("drafts, tests, releases and traces on the bank's own data", async () => {
    const circular = { ref: bank.circular.ref, title: bank.circular.title, issuedOn: "2026-10-01", issuer: "RBI (SYNTHETIC)", amends: "", synthetic: true, text: bank.circular.text };
    const ctx = await createContext({ bank: bank.key, circular });
    const bundle = await runProposal(ctx);

    expect(bundle.bankKey).toBe(bank.key);
    expect(bundle.entityType).toBe(bank.profile.entityType);
    expect(bundle.clauses.some((c) => c.applicability === "applies")).toBe(true);
    expect(bundle.drafts.length).toBeGreaterThan(0);
    expect(bundle.testsTotal).toBeGreaterThan(0);
    expect(bundle.testsPassed).toBe(bundle.testsTotal);
    expect(bundle.impact.days).toBe(90);

    const tokens: Record<string, string[]> = {};
    for (const d of bundle.drafts) tokens[d.ruleId] = APPROVERS.map((a) => issueToken({ rule_id: d.ruleId, version: d.version, yaml: d.yaml }, a, undefined, bundle.runId).token);
    const events: RunEvent[] = [];
    const res = await runRelease(await createContext({ bank: bank.key, circular, emit: (e) => events.push(e) }), { bundle, tokens, injectDrift: false });
    expect(res.ok).toBe(true);
    const modes = new Set(events.filter((e) => e.type === "rollout").map((e) => (e.type === "rollout" ? e.state.mode : "")));
    expect(modes.has("shadow") && modes.has("canary") && modes.has("live")).toBe(true);
    const thread = events.find((e) => e.type === "thread");
    if (thread && thread.type === "thread") expect(thread.thread.circular?.ref).toBeTruthy();
  });
});

describe.each(BANKS.map((b) => [b.short, b] as const))("%s: circular read from its PDF", (_name, bank) => {
  it("extracts the PDF and drafts the same rules as the source text", async () => {
    const { readFileSync } = await import("node:fs");
    const { extractDocument } = await import("@/niyam/intake");
    const bytes = new Uint8Array(readFileSync(`public${bank.circular.pdf}`));
    const doc = await extractDocument(bytes, bank.circular.pdf);
    expect(doc.method).toBe("pdf-text-layer");
    const mk = (text: string) => ({ ref: bank.circular.ref, title: bank.circular.title, issuedOn: "", issuer: "", amends: "", synthetic: true, text });
    const fromPdf = await runProposal(await createContext({ bank: bank.key, circular: mk(doc.text) }));
    const fromText = await runProposal(await createContext({ bank: bank.key, circular: mk(bank.circular.text) }));
    const sig = (b: typeof fromPdf) => b.drafts.map((d) => `${d.ruleId}:${d.yaml.match(/op: "([^"]+)"/)?.[1]}${d.yaml.match(/value: ([\d.]+)/)?.[1]}`).sort();
    expect(sig(fromPdf)).toEqual(sig(fromText));
    expect(fromPdf.testsPassed).toBe(fromPdf.testsTotal);
  });
});

describe("bank hosts", () => {
  it("proxy host map matches every bank's host", async () => {
    const { readFileSync } = await import("node:fs");
    const proxy = readFileSync("src/proxy.ts", "utf8");
    for (const b of BANKS) expect(proxy).toContain(`"${b.host}": "${b.key}"`);
  });
});

describe("circular subject", () => {
  it("takes the line after the salutation, not the letterhead", async () => {
    const { subjectOf } = await import("@/niyam/inputs");
    for (const b of BANKS) expect(subjectOf(b.circular.text)).toBe(b.circular.text.split("\n").map((l) => l.trim()).filter(Boolean)[b.circular.text.split("\n").map((l) => l.trim()).filter(Boolean).findIndex((l) => l.startsWith("Madam")) + 1]);
    expect(subjectOf("RESERVE BANK OF INDIA (SYNTHETIC SAMPLE)\nRBI/2026-27/SYN-031\nMadam / Sir,\nLarge Exposures Framework\n1. Applicability.")).toBe("Large Exposures Framework");
  });
});
