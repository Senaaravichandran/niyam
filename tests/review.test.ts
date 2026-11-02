import { describe, expect, it } from "vitest";
import { APPROVERS, REVIEW_CHECKS, cleanReview, issueToken, verifyToken, verifyTwoPerson } from "@/niyam/approvals/token";

const rule = { rule_id: "SYN-EXP-012", version: 2, yaml: "rule_id: SYN-EXP-012\nversion: 2\n" };
const review = (name: string) => ({ name, employeeId: "EMP-1042", reason: "Matches para 4(b) and all tests pass", checks: [...REVIEW_CHECKS] });

describe("approver review", () => {
  it("signs the reviewer's name, ID, reason and checks into the token", () => {
    const r = cleanReview(review("Anita Menon"));
    expect(typeof r).not.toBe("string");
    const t = issueToken(rule, APPROVERS[0], undefined, "RUN-1", r as Exclude<typeof r, string>);
    const v = verifyToken(t.token, rule.yaml, rule.rule_id, "RUN-1");
    expect(v.ok).toBe(true);
    expect(v.payload).toMatchObject({ approver_name: "Anita Menon", employee_id: "EMP-1042", duty: "Maker" });
    expect(v.payload?.checks).toHaveLength(REVIEW_CHECKS.length);
  });

  it("rejects a review without a reason or with unticked checks", () => {
    expect(cleanReview({ ...review("A B"), reason: "ok" })).toMatch(/reason/);
    expect(cleanReview({ ...review("A B"), checks: [REVIEW_CHECKS[0]] })).toMatch(/Tick every/);
    expect(cleanReview({ ...review("A B"), employeeId: "x y" })).toMatch(/employee ID/);
    expect(cleanReview({ ...review("A B") })).toMatchObject({ name: "A B" });
  });

  it("refuses two signatures under the same name", () => {
    const same = cleanReview(review("Ravi Iyer")) as Exclude<ReturnType<typeof cleanReview>, string>;
    const t1 = issueToken(rule, APPROVERS[0], undefined, "RUN-1", same).token;
    const t2 = issueToken(rule, APPROVERS[1], undefined, "RUN-1", same).token;
    expect(verifyTwoPerson([t1, t2], rule.yaml, rule.rule_id, "RUN-1").ok).toBe(false);
  });
});
