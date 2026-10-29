import { describe, expect, it } from "vitest";
import { compileRule } from "@/niyam/dsl/compile";
import { parseRule, RuleParseError, toYaml, type Rule } from "@/niyam/dsl/schema";
import { generateTests, runTests } from "@/niyam/dsl/testgen";
import type { Obligation } from "@/niyam/types";

const rule: Rule = {
  rule_id: "SYN-EXP-012",
  version: 2,
  status: "draft",
  title: "Group exposure report",
  applies_to: ["UCB", "NBFC-ML", "NBFC-UL"],
  when: { metric: "group_exposure_pct_tier1", op: ">", value: 12, unit: "pct" },
  action: "flag_for_report",
  severity: "high",
  source: { circular: "RBI-SYN-2026-017", clause: "4(b)", span: "exposure exceeding 12 per cent of Tier 1 capital" },
};

const ob: Obligation = {
  id: "OBL-017-4b",
  clauseId: "CL-017-4b",
  clauseNumber: "4(b)",
  kind: "quantitative",
  modality: "MUST",
  actor: "RegulatedEntity",
  metric: "group_exposure_pct_tier1",
  operator: ">",
  comparatorPhrase: "exceeding",
  threshold: 12,
  unit: "pct",
  action: "flag_for_report",
  effectiveFrom: "2026-12-01",
  scope: ["UCB", "NBFC-ML", "NBFC-UL"],
  span: "exposure exceeding 12 per cent of Tier 1 capital",
  spanStart: 0,
  spanEnd: 10,
  extractedBy: "rule-based",
};

describe("rule DSL", () => {
  it("round-trips through YAML with a stable key order", () => {
    const y = toYaml(rule);
    expect(parseRule(y)).toEqual(rule);
    expect(toYaml(parseRule(y))).toBe(y);
    expect(y.indexOf("rule_id")).toBe(0);
    expect(y).toContain('op: ">"');
  });

  it("rejects unknown metrics, operators and extra fields", () => {
    expect(() => parseRule(toYaml(rule).replace('op: ">"', 'op: "=>"'))).toThrow(RuleParseError);
    expect(() => parseRule(toYaml(rule).replace("group_exposure_pct_tier1", "made_up_metric"))).toThrow(RuleParseError);
    expect(() => parseRule(`${toYaml(rule)}exec: "rm -rf /"\n`)).toThrow(RuleParseError);
  });

  it("compiles to SQL with the strict operator and a float-safe percentage", () => {
    const { sql, grain } = compileRule(rule);
    expect(grain).toBe("group");
    expect(sql).toContain("ROUND(SUM(l.outstanding_amt) * 100.0 / NULLIF(c.tier1_amt, 0), 6) > 12");
    expect(sql).toContain("GROUP BY l.as_of, l.group_id");
  });

  it("compiles the Board exception only when the rule carries one", () => {
    expect(compileRule(rule).sql).not.toContain("board_approved");
    expect(compileRule({ ...rule, unless: "board_approved" }).sql).toContain("MAX(l.board_approved) = 0");
  });

  it("compiles bank-level concentration with a window function", () => {
    const { sql } = compileRule({ ...rule, rule_id: "SYN-CON-020", when: { ...rule.when, metric: "top20_share_pct_loans", value: 40 } });
    expect(sql).toContain("ROW_NUMBER() OVER (PARTITION BY as_of");
  });
});

describe("tests generated from the obligation", () => {
  it("puts a test exactly on the boundary", () => {
    const tests = generateTests("SYN-EXP-012", ob, { boardOverrideTest: true });
    expect(tests.map((t) => t.name)).toEqual([
      "Just below the limit",
      "Exactly on the limit",
      "Just above the limit",
      "Out of scope entity",
      "Board approval does not suppress",
    ]);
    expect(tests.find((t) => t.name === "Exactly on the limit")!.expectFire).toBe(false);
  });

  it("passes for the correct rule and fails the boundary for >=", async () => {
    const tests = generateTests("SYN-EXP-012", ob, { boardOverrideTest: true });
    const good = await runTests(rule, tests);
    expect(good.every((r) => r.pass)).toBe(true);

    const bad = await runTests({ ...rule, when: { ...rule.when, op: ">=" } }, tests);
    const failed = bad.filter((r) => !r.pass).map((r) => r.name);
    expect(failed).toEqual(["Exactly on the limit"]);
  });

  it("catches a stale Board exception", async () => {
    const tests = generateTests("SYN-EXP-012", ob, { boardOverrideTest: true });
    const res = await runTests({ ...rule, unless: "board_approved" }, tests);
    expect(res.filter((r) => !r.pass).map((r) => r.name)).toEqual(["Board approval does not suppress"]);
  });
});
