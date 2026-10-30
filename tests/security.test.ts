import { describe, expect, it } from "vitest";
import { createContext } from "@/niyam/context";
import { runProposal, runRelease } from "@/niyam/pipeline";
import { APPROVERS, issueToken, verifyPack } from "@/niyam/approvals/token";
import { parseRule, RuleSchema } from "@/niyam/dsl/schema";
import { compileRule } from "@/niyam/dsl/compile";
import { getBookDb, runQuery } from "@/niyam/sql/engine";

async function signedRun() {
  const bundle = await runProposal(await createContext());
  const tokens: Record<string, string[]> = {};
  for (const d of bundle.drafts) tokens[d.ruleId] = APPROVERS.map((a) => issueToken({ rule_id: d.ruleId, version: d.version, yaml: d.yaml }, a, undefined, bundle.runId).token);
  return { bundle, tokens };
}

describe("security regressions from the audit", () => {
  it("rejects SQL smuggled through a rule's text fields", () => {
    const base = parseRule(['rule_id: SYN-EXP-012', 'version: 2', 'status: draft', 'title: Group exposure', 'applies_to: [UCB]', 'when:', '  metric: group_exposure_pct_tier1', '  op: ">"', '  value: 12', '  unit: pct', 'action: flag_for_report', 'severity: high', 'source:', '  circular: RBI-SYN-2026-017', '  clause: "4(b)"', '  span: aggregate exposure exceeding 12 per cent', ''].join(String.fromCharCode(10)));
    const evil = { ...base, source: { ...base.source, span: "xxxxxxxx" + String.fromCharCode(10) + "DELETE FROM capital;" + String.fromCharCode(10) + "--" } };
    const res = RuleSchema.safeParse(evil);
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/single line/);
    // Even if a newline reached the compiler, the header would stay a comment.
    expect(compileRule(evil as typeof base).sql.split(String.fromCharCode(10)).filter((l) => l.includes("DELETE")).every((l) => l.trim().startsWith("--"))).toBe(true);
  });

  it("runs only one read-only statement", async () => {
    const db = await getBookDb();
    expect(() => runQuery(db, "SELECT 1; DELETE FROM capital")).toThrow(/single SQL statement/);
    expect(() => runQuery(db, "DELETE FROM capital")).toThrow(/must be a SELECT/);
    const rule = parseRule('rule_id: SYN-EXP-012\nversion: 2\nstatus: draft\ntitle: Group exposure\napplies_to: [UCB]\nwhen:\n  metric: group_exposure_pct_tier1\n  op: ">"\n  value: 12\n  unit: pct\naction: flag_for_report\nseverity: high\nsource:\n  circular: RBI-SYN-2026-017\n  clause: "4(b)"\n  span: aggregate exposure exceeding 12 per cent\n');
    expect(runQuery(db, compileRule(rule).sql).length).toBeGreaterThan(0);
  });

  it("refuses a pack whose forecasts were inflated to silence the Sentinel", async () => {
    const { bundle, tokens } = await signedRun();
    const forged = { ...bundle, impact: { ...bundle.impact, rules: bundle.impact.rules.map((r) => ({ ...r, forecastSd: 1e9 })) } };
    expect(verifyPack(forged).ok).toBe(false);
    const res = await runRelease(await createContext(), { bundle: forged, tokens, injectDrift: true });
    expect(res.ok).toBe(false);
  });

  it("refuses a pack the server never signed", async () => {
    const { bundle, tokens } = await signedRun();
    const unsigned = { ...bundle, signature: undefined };
    const res = await runRelease(await createContext(), { bundle: unsigned, tokens, injectDrift: false });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not signed/);
  });

  it("refuses tokens from another run", async () => {
    const a = await signedRun();
    const b = await signedRun();
    const res = await runRelease(await createContext(), { bundle: a.bundle, tokens: b.tokens, injectDrift: false });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/another run/);
  });
});
