import { describe, expect, it } from "vitest";
import { extractClause, interpretComparator } from "@/niyam/agents/extractor";
import type { Clause } from "@/niyam/types";

const REF = "RBI-SYN-2026-017";
const metric = () => "group_exposure_pct_tier1";

function clause(number: string, text: string): Clause {
  return {
    id: `CL-017-${number.replace(/[()]/g, "")}`,
    number,
    heading: "Test",
    text,
    applicability: "applies",
    reason: "test",
    scope: ["UCB"],
  };
}

const one = (text: string, number = "4(b)") => extractClause(clause(number, text), REF, "2026-12-01", metric);

describe("Extractor comparators", () => {
  it("reads 'exceeding X per cent' as fire on '>' (equality does not trigger)", () => {
    const [o] = one(
      "A regulated entity shall flag for report any group of connected counterparties with an aggregate exposure exceeding 12 per cent of Tier 1 capital.",
    );
    expect(o.kind).toBe("quantitative");
    expect(o.operator).toBe(">");
    expect(o.threshold).toBe(12);
    expect(o.comparatorPhrase).toBe("exceeding");
    expect(o.action).toBe("flag_for_report");
  });

  it("reads 'shall not exceed' as fire on '>'", () => {
    const [o] = one(
      "The aggregate exposure of a regulated entity to its twenty largest borrowers shall not exceed 40 per cent of its total loans and advances.",
      "4(c)",
    );
    expect(o.operator).toBe(">");
    expect(o.threshold).toBe(40);
    expect(o.comparatorPhrase).toBe("shall not exceed");
    expect(o.modality).toBe("MUST_NOT");
  });

  it("reads 'not less than' as a floor that fires on '<'", () => {
    const [o] = one("A regulated entity shall maintain an exposure not less than 8 per cent of Tier 1 capital.");
    expect(o.operator).toBe("<");
    expect(o.comparatorPhrase).toBe("not less than");
  });

  it("reads bare 'less than' as fire on '>='", () => {
    const [o] = one("A regulated entity shall keep its exposure less than 5 per cent of Tier 1 capital.");
    expect(o.operator).toBe(">=");
    expect(o.comparatorPhrase).toBe("less than");
  });

  it("interpretComparator prefers the longer negated phrase over its substring", () => {
    expect(interpretComparator("not exceeding")?.fire).toBe(">");
    expect(interpretComparator("not less than")?.fire).toBe("<");
    expect(interpretComparator("less than")?.fire).toBe(">=");
    expect(interpretComparator("exceeding")?.fire).toBe(">");
    expect(interpretComparator("equal to")).toBeUndefined();
  });

  it("maps 'shall not take an exposure' to block_new_exposure", () => {
    const [o] = one(
      "A regulated entity shall not take an exposure to a single counterparty exceeding 10 per cent of its Tier 1 capital.",
      "4(a)",
    );
    expect(o.action).toBe("block_new_exposure");
    expect(o.id).toBe("OBL-017-4a");
  });
});

describe("Extractor spans", () => {
  const cases = [
    "A regulated entity shall flag for report any group of connected counterparties with an aggregate exposure exceeding 12 per cent of Tier 1 capital.",
    "A regulated entity shall not take an exposure to a single counterparty exceeding 10 per cent of its Tier 1 capital.",
    "The aggregate exposure of a regulated entity to its twenty largest borrowers shall not exceed 40 per cent of its total loans and advances.",
  ];

  it.each(cases)("span is an exact substring at [spanStart, spanEnd): %s", (text) => {
    const [o] = one(text);
    expect(o.spanStart).toBeGreaterThanOrEqual(0);
    expect(text.slice(o.spanStart, o.spanEnd)).toBe(o.span);
    expect(o.spanEnd - o.spanStart).toBe(o.span.length);
  });

  it("span for 4(b) runs from 'aggregate exposure' to the end of the percentage phrase", () => {
    const [o] = one(cases[0]);
    expect(o.span).toBe("aggregate exposure exceeding 12 per cent of Tier 1 capital");
  });

  it("span for 4(a) starts at the nearest 'exposure' before the comparator", () => {
    const [o] = one(cases[1], "4(a)");
    expect(o.span).toBe("exposure to a single counterparty exceeding 10 per cent of its Tier 1 capital");
  });
});

describe("Extractor procedural obligations", () => {
  const p5 =
    "Any exposure flagged under paragraph 4 shall be placed before the Board of Directors within 30 days, and no internal policy shall permit a group exposure above the limit in paragraph 4(b), including with the approval of the Board.";

  it("detects the 30-day Board deadline and the policy constraint", () => {
    const obs = one(p5, "5");
    expect(obs.map((o) => o.action)).toEqual(["board_report", "policy_constraint"]);
    expect(obs.every((o) => o.kind === "procedural")).toBe(true);
    expect(obs[0].span).toBe("shall be placed before the Board of Directors within 30 days");
    expect(obs[1].span).toBe("no internal policy shall permit a group exposure above the limit in paragraph 4(b)");
    expect(obs[1].modality).toBe("MUST_NOT");
    for (const o of obs) expect(p5.slice(o.spanStart, o.spanEnd)).toBe(o.span);
    expect(obs[0].id).not.toBe(obs[1].id);
  });

  it("yields no quantitative obligation for a clause without a percentage", () => {
    const obs = one(p5, "5");
    expect(obs.some((o) => o.kind === "quantitative")).toBe(false);
    expect(obs.every((o) => o.threshold === undefined && o.operator === undefined)).toBe(true);
  });

  it("yields nothing for a clause with a comparator but no percentage or procedure", () => {
    expect(one("A regulated entity shall not take exposures exceeding prudent levels.")).toEqual([]);
  });
});
