import { describe, expect, it } from "vitest";
import { APPROVERS, issueToken, verifyToken, verifyTwoPerson } from "@/niyam/approvals/token";

const yamlA = 'rule_id: SYN-EXP-012\nversion: 2\nwhen:\n  op: ">"\n  value: 12\n';
const yamlB = 'rule_id: SYN-EXP-011\nversion: 2\nwhen:\n  op: ">"\n  value: 10\n';
const ruleA = { rule_id: "SYN-EXP-012", version: 2, yaml: yamlA };
const ruleB = { rule_id: "SYN-EXP-011", version: 2, yaml: yamlB };
const [CCO, RISK] = APPROVERS;

describe("approval token edge cases", () => {
  it("a token for rule A is rejected for rule B, even against rule A's own file", () => {
    const t = issueToken(ruleA, CCO).token;
    const v = verifyToken(t, yamlA, "SYN-EXP-011");
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/SYN-EXP-012, not SYN-EXP-011/);
    expect(verifyToken(t, yamlB, "SYN-EXP-011").ok).toBe(false);
  });

  it("two-person check for rule B rejects a valid pair of tokens issued for rule A", () => {
    const tokens = [issueToken(ruleA, CCO).token, issueToken(ruleA, RISK).token];
    expect(verifyTwoPerson(tokens, yamlA, "SYN-EXP-012").ok).toBe(true);
    expect(verifyTwoPerson(tokens, yamlB, "SYN-EXP-011").ok).toBe(false);
  });

  it("rejects two individually valid tokens from the same approver", () => {
    const t1 = issueToken(ruleA, CCO, new Date(Date.now() - 120_000).toISOString()).token;
    const t2 = issueToken(ruleA, CCO, new Date(Date.now() - 60_000).toISOString()).token;
    expect(t1).not.toBe(t2);
    const res = verifyTwoPerson([t1, t2], yamlA, "SYN-EXP-012");
    expect(res.results.every((r) => r.ok)).toBe(true);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Two different approvers/);
  });

  it("rejects when one of the two tokens was signed over a different file", () => {
    const good = issueToken(ruleA, CCO).token;
    const otherFile = issueToken({ ...ruleA, yaml: yamlA.replace("value: 12", "value: 15") }, RISK).token;
    const res = verifyTwoPerson([good, otherFile], yamlA, "SYN-EXP-012");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/changed after approval/);
    expect(res.results.map((r) => r.ok)).toEqual([true, false]);
  });

  it("rejects an empty token list", () => {
    expect(verifyTwoPerson([], yamlA, "SYN-EXP-012").ok).toBe(false);
  });

  it("rejects a malformed token without throwing", () => {
    expect(verifyToken("not-a-token", yamlA, "SYN-EXP-012")).toMatchObject({ ok: false, reason: "Malformed token" });
  });

  it("rejects a payload swapped onto another token's signature", () => {
    const a = issueToken(ruleA, CCO).token;
    const b = issueToken(ruleB, CCO).token;
    const forged = `${b.split(".")[0]}.${a.split(".")[1]}`;
    expect(verifyToken(forged, yamlB, "SYN-EXP-011").ok).toBe(false);
  });
});

describe("approval expiry and run binding", () => {
  const yaml = 'rule_id: SYN-EXP-012\nversion: 2\n';
  const rule = { rule_id: "SYN-EXP-012", version: 2, yaml };
  it("rejects a token older than 24 hours", () => {
    const old = issueToken(rule, CCO, new Date(Date.now() - 25 * 3600_000).toISOString()).token;
    expect(verifyToken(old, yaml, "SYN-EXP-012").reason).toMatch(/expired/);
  });
  it("rejects a token issued for another run", () => {
    const t = issueToken(rule, CCO, undefined, "RUN-A").token;
    expect(verifyToken(t, yaml, "SYN-EXP-012", "RUN-A").ok).toBe(true);
    expect(verifyToken(t, yaml, "SYN-EXP-012", "RUN-B").reason).toMatch(/another run/);
  });
});
