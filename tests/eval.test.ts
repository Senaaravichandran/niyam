import { describe, expect, it } from "vitest";
import { EVAL_CLAUSES } from "@/niyam/eval/clauses";
import { SEEDED_BUGS } from "@/niyam/eval/bugs";
import { runEval } from "@/niyam/eval/run";

describe("Evaluation harness", () => {
  it("has 30 labelled clauses and 10 seeded bugs with unique ids", () => {
    expect(EVAL_CLAUSES).toHaveLength(30);
    expect(new Set(EVAL_CLAUSES.map((c) => c.id)).size).toBe(30);
    expect(SEEDED_BUGS).toHaveLength(10);
  });

  it("runs end to end, does not flag the control, and catches at least 8 of 10 seeded bugs", async () => {
    const r = await runEval();
    const f = r.extraction.perField;
    // Reported, not asserted: these are honest measurements of the rule-based extractor.
    console.log(
      `[eval] extraction n=${r.extraction.n} all-fields=${r.extraction.allFieldsCorrect}/${r.extraction.n} ` +
        (["kind", "operator", "threshold", "metric"] as const)
          .map((k) => `${k} acc=${f[k].correct}/${r.extraction.n} P=${f[k].precision.toFixed(2)} R=${f[k].recall.toFixed(2)}`)
          .join(" | "),
    );
    console.log(
      `[eval] validator caught ${r.validator.caught}/${r.validator.bugs} (static ${r.validator.caughtByStatic}, tests ${r.validator.caughtByTests}); ` +
        `control flagged=${r.validator.falsePositivesOnControl}; missed=${JSON.stringify(r.validator.missed)}; ${r.durationMs} ms`,
    );
    for (const x of r.extraction.failures)
      console.log(`[eval] extractor wrong on ${x.id} (${x.wrongFields.join(",")}): gold ${JSON.stringify(x.gold)} got ${x.got.kind} ${x.got.metric ?? "-"} ${x.got.operator ?? "-"} ${x.got.threshold ?? "-"}`);
    for (const b of r.validator.results) console.log(`[eval] ${b.id} ${b.label}: ${b.caughtBy.join(", ") || "MISSED"}`);

    expect(r.extraction.n).toBe(30);
    expect(r.extraction.failures.length + r.extraction.allFieldsCorrect).toBe(30);
    expect(r.validator.obligation.id).toBe("OBL-017-4b");
    expect(r.validator.falsePositivesOnControl).toBe(0);
    expect(r.validator.control.failingTests).toHaveLength(0);
    expect(r.validator.caught).toBeGreaterThanOrEqual(8);
  });
});
