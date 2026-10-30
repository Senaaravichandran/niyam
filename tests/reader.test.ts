import { describe, expect, it } from "vitest";
import { parseEffectiveDate, scopeFromText, segment } from "@/niyam/agents/reader";
import { CIRCULAR } from "@/niyam/data/circular";

const run = () => segment(CIRCULAR.ref, CIRCULAR.text, "UCB");
const byNumber = (n: string) => run().clauses.find((c) => c.number === n);

describe("Reader.segment on the synthetic circular", () => {
  it("splits '4.' into its '(a)/(b)/(c)' sub-paragraphs with stable IDs", () => {
    const numbers = run().clauses.map((c) => c.number);
    expect(numbers).toEqual(["1", "2", "3", "4(a)", "4(b)", "4(c)", "5", "6", "7"]);
    expect(byNumber("4(b)")?.id).toBe("CL-017-4b");
    expect(byNumber("4(a)")?.heading).toBe("Exposure limits");
  });

  it("drops the heading-only parent paragraph '4. Exposure limits.'", () => {
    const { clauses } = run();
    expect(clauses.find((c) => c.number === "4")).toBeUndefined();
    expect(clauses.every((c) => c.text.length > 0)).toBe(true);
  });

  it("scopes the Upper Layer paragraph to NBFC-UL and marks it not applicable for a UCB", () => {
    const p6 = byNumber("6")!;
    expect(p6.scope).toEqual(["NBFC-UL"]);
    expect(p6.applicability).toBe("not_applicable");
    expect(p6.reason).toMatch(/NBFC-UL/);
  });

  it("marks the Upper Layer paragraph applicable when the bank is NBFC-UL", () => {
    const p6 = segment(CIRCULAR.ref, CIRCULAR.text, "NBFC-UL").clauses.find((c) => c.number === "6")!;
    expect(p6.applicability).toBe("applies");
  });

  it("applies the operative limits in paragraph 4 to a UCB via the Applicability paragraph", () => {
    const { clauses, baseScope } = run();
    expect(baseScope).toEqual(expect.arrayContaining(["UCB", "NBFC-ML", "NBFC-UL"]));
    for (const n of ["4(a)", "4(b)", "4(c)", "5"]) {
      expect(clauses.find((c) => c.number === n)?.applicability).toBe("applies");
    }
  });

  it("treats short title, applicability, definitions and repeal as informational", () => {
    for (const n of ["1", "2", "3", "7"]) expect(byNumber(n)?.applicability).toBe("informational");
  });

  it("parses the effective date from the commencement paragraph", () => {
    expect(run().effectiveFrom).toBe("2026-12-01");
  });

  it("does not fold salutation or signature lines into any clause", () => {
    const all = run().clauses.map((c) => c.text).join("\n");
    expect(all).not.toMatch(/Madam|Sir,|Yours faithfully|Signatory|Chief General Manager/i);
    expect(byNumber("7")?.text).toBe(
      "Paragraphs 5.2 and 5.3 of MD-SYN-LEF-2025 stand withdrawn from the date these directions come into force.",
    );
  });

  it("ignores the signature block even without a blank line before it", () => {
    const text = [
      "1. Exposure limits. A regulated entity shall not take an exposure exceeding 10 per cent of its Tier 1 capital.",
      "Yours faithfully,",
      "(Synthetic Signatory)",
      "Chief General Manager",
    ].join("\n");
    const { clauses } = segment("RBI-SYN-2026-099", text, "UCB");
    expect(clauses).toHaveLength(1);
    expect(clauses[0].text).toBe(
      "A regulated entity shall not take an exposure exceeding 10 per cent of its Tier 1 capital.",
    );
  });

  it("reports 'unspecified' when no commencement date is present", () => {
    const { effectiveFrom } = segment("X-001", "1. Limits. A bank shall not exceed 5 per cent of capital.", "UCB");
    expect(effectiveFrom).toBe("unspecified");
  });
});

describe("Reader helpers", () => {
  it("parseEffectiveDate zero-pads month and day", () => {
    expect(parseEffectiveDate("shall come into force on April 5, 2027.")).toBe("2027-04-05");
  });

  it("parseEffectiveDate rejects an unknown month name", () => {
    expect(parseEffectiveDate("shall come into force on Smarch 5, 2027.")).toBeUndefined();
  });

  it("scopeFromText returns null when a clause names no specific layer", () => {
    expect(scopeFromText("A regulated entity shall flag for report any group.")).toBeNull();
    expect(scopeFromText("NBFCs in the Middle Layer and the Upper Layer")).toBeNull();
  });
});
