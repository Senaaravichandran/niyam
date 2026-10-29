import { describe, expect, it } from "vitest";
import { APPROVERS, issueToken, sha256, verifyToken, verifyTwoPerson } from "@/niyam/approvals/token";

const yaml = 'rule_id: SYN-EXP-012\nversion: 2\nwhen:\n  op: ">"\n  value: 12\n';
const rule = { rule_id: "SYN-EXP-012", version: 2, yaml };

describe("approval tokens", () => {
  it("binds the token to the SHA-256 of the exact rule file", () => {
    const t = issueToken(rule, APPROVERS[0]);
    expect(t.payload.rule_sha256).toBe(sha256(yaml));
    expect(verifyToken(t.token, yaml, "SYN-EXP-012").ok).toBe(true);
  });

  it("is void after any edit to the rule", () => {
    const t = issueToken(rule, APPROVERS[0]);
    const edited = yaml.replace("value: 12", "value: 13");
    const v = verifyToken(t.token, edited, "SYN-EXP-012");
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/changed after approval/);
  });

  it("rejects a forged signature", () => {
    const t = issueToken(rule, APPROVERS[0]);
    const [body] = t.token.split(".");
    expect(verifyToken(`${body}.AAAA`, yaml, "SYN-EXP-012").ok).toBe(false);
  });

  it("rejects a token for another rule", () => {
    const t = issueToken(rule, APPROVERS[0]);
    expect(verifyToken(t.token, yaml, "SYN-EXP-011").ok).toBe(false);
  });

  it("requires two different people in two different roles", () => {
    const a = issueToken(rule, APPROVERS[0]).token;
    const b = issueToken(rule, APPROVERS[1]).token;
    expect(verifyTwoPerson([a, b], yaml, "SYN-EXP-012").ok).toBe(true);
    const same = verifyTwoPerson([a, a], yaml, "SYN-EXP-012");
    expect(same.ok).toBe(false);
    expect(same.reason).toMatch(/Two different approvers/);
    expect(verifyTwoPerson([a], yaml, "SYN-EXP-012").ok).toBe(false);
  });
});
