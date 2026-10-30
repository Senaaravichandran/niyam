"use client";

import { useEffect, useState } from "react";
import type { EvalReport, Field, Got } from "@/niyam/eval/run";
import type { Gold } from "@/niyam/eval/clauses";

const FIELD_LABEL: Record<Field, string> = {
  kind: "Kind",
  operator: "Operator",
  threshold: "Threshold",
  metric: "Metric",
};
const FIELDS: Field[] = ["kind", "operator", "threshold", "metric"];

const pct = (x: number) => `${Math.round(x * 100)}%`;

function unitLabel(u?: string | null) {
  if (!u || u === "pct") return "%";
  if (u === "inr_lakh") return " lakh";
  if (u === "inr_crore") return " crore";
  return ` ${u}`;
}

function describeGold(g: Gold) {
  if (g.kind !== "quantitative") return g.kind;
  return `${g.metric ?? "no model metric"} ${g.operator} ${g.threshold}${unitLabel(g.unit)}`;
}

function describeGot(g: Got) {
  if (g.kind !== "quantitative") return g.kind;
  return `${g.metric ?? "no metric"} ${g.operator ?? "?"} ${g.threshold ?? "?"}${unitLabel(g.unit)}`;
}

function Stat({ value, of, label, tone = "ink" }: { value: number; of: number; label: string; tone?: "ink" | "ok" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-ink";
  return (
    <div className="bg-surface px-4 py-4">
      <p className={`num ui text-[34px] font-bold leading-none tracking-[-0.03em] ${color}`}>
        {value}
        <span className="text-[18px] font-semibold text-muted">/{of}</span>
      </p>
      <p className="ui mt-2 text-[13px] text-muted">{label}</p>
    </div>
  );
}

export function Scorecard() {
  const [data, setData] = useState<EvalReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/eval")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
        return j as EvalReport;
      })
      .then((j) => alive && setData(j))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <section data-ui aria-labelledby="eval-h" className="bg-bg">
        <h2 id="eval-h" className="text-[22px] tracking-[-0.025em]">
          Evaluation scorecard
        </h2>
        <p role="alert" className="ui mt-3 bg-bad-soft px-4 py-3 text-[14px] text-bad">
          Evaluation failed to run: {error}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section data-ui aria-labelledby="eval-h" aria-busy="true" className="bg-bg">
        <h2 id="eval-h" className="text-[22px] tracking-[-0.025em]">
          Evaluation scorecard
        </h2>
        <p role="status" className="ui mt-3 bg-surface px-4 py-6 text-[14px] text-muted">
          Running the extractor on 30 labelled clauses and the validator on 10 seeded bugs.
        </p>
      </section>
    );
  }

  const { extraction: ex, validator: v } = data;
  const n = ex.n;

  return (
    <section data-ui aria-labelledby="eval-h" className="bg-bg text-ink">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="eval-h" className="text-[22px] tracking-[-0.025em]">
          Evaluation scorecard
        </h2>
        <p className="num ui text-[12.5px] text-muted">
          Synthetic test set · measured in {data.durationMs} ms · {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>
      <p className="mt-2 max-w-[70ch] text-[15px] text-muted">
        Thirty hand-labelled synthetic clauses, run through the rule-based Extractor exactly as it ships, and ten deliberately broken
        versions of SYN-EXP-012 v2 run through the Validator&rsquo;s checks and the tests generated from the clause. Nothing was tuned to this set.
      </p>

      {/* ---------- headline numbers ---------- */}
      <h3 className="ui mt-6 text-[15px] font-semibold tracking-normal">Extraction (rule-based path)</h3>
      <div className="mt-2 grid grid-cols-2 gap-px sm:grid-cols-5">
        <Stat value={ex.allFieldsCorrect} of={n} label="clauses fully correct" />
        {FIELDS.map((f) => (
          <Stat key={f} value={ex.perField[f].correct} of={n} label={`${FIELD_LABEL[f].toLowerCase()} accuracy`} />
        ))}
      </div>

      <h3 className="ui mt-6 text-[15px] font-semibold tracking-normal">Validation (seeded bugs)</h3>
      <div className="mt-2 grid grid-cols-2 gap-px sm:grid-cols-4">
        <Stat value={v.caught} of={v.bugs} label="seeded bugs caught" tone={v.caught === v.bugs ? "ok" : "bad"} />
        <Stat value={v.caughtByStatic} of={v.bugs} label="caught by static checks" />
        <Stat value={v.caughtByTests} of={v.bugs} label="caught by generated tests" />
        <Stat value={v.falsePositivesOnControl} of={1} label="correct rule wrongly flagged" tone={v.falsePositivesOnControl ? "bad" : "ok"} />
      </div>

      {/* ---------- per-field table ---------- */}
      <h3 className="ui mt-8 text-[15px] font-semibold tracking-normal">Per-field scores</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="ui w-full min-w-[560px] border-collapse text-[13px]">
          <caption className="sr-only">Precision, recall and accuracy of the rule-based extractor per field</caption>
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="px-3 py-2 font-normal">Field</th>
              <th scope="col" className="px-3 py-2 font-normal">Accuracy</th>
              <th scope="col" className="px-3 py-2 font-normal">Precision</th>
              <th scope="col" className="px-3 py-2 font-normal">Recall</th>
              <th scope="col" className="px-3 py-2 font-normal">Predicted / gold</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => {
              const s = ex.perField[f];
              return (
                <tr key={f} className="odd:bg-surface">
                  <th scope="row" className="px-3 py-2 text-left font-semibold">{FIELD_LABEL[f]}</th>
                  <td className="num px-3 py-2">
                    {s.correct}/{n} <span className="text-muted">({pct(s.accuracy)})</span>
                  </td>
                  <td className="num px-3 py-2">
                    {s.truePositives}/{s.predicted} <span className="text-muted">({pct(s.precision)})</span>
                  </td>
                  <td className="num px-3 py-2">
                    {s.truePositives}/{s.gold} <span className="text-muted">({pct(s.recall)})</span>
                  </td>
                  <td className="num px-3 py-2 text-muted">
                    {s.predicted} / {s.gold}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ui mt-2 text-[12.5px] text-muted">
        Precision counts values the extractor produced; recall counts values the gold label has; accuracy also credits agreeing on &ldquo;no value&rdquo;.
      </p>

      {/* ---------- failures ---------- */}
      <h3 className="ui mt-8 text-[15px] font-semibold tracking-normal">
        Where the rule-based extractor is wrong ({ex.failures.length} of {n})
      </h3>
      <p className="mt-1 max-w-[70ch] text-[14px] text-muted">
        These are real weaknesses of the pattern-based path: other words for a metric, numbers written as words or with a % sign, rupee
        limits, and comparators it misreads. The LLM extraction path exists for these clauses, and its proposals pass the same exact-span
        verification before anything is written.
      </p>
      <ul className="m-0 mt-3 p-0">
        {ex.failures.map((x) => (
          <li key={x.id} className="list-none bg-surface px-4 py-3 [&+&]:mt-px">
            <div className="ui flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
              <span className="font-semibold">{x.id}</span>
              <span className="text-muted">wrong: {x.wrongFields.join(", ")}</span>
              {x.trap && <span className="text-muted">· {x.trap}</span>}
            </div>
            <p className="mt-1 text-[14.5px]">&ldquo;{x.text}&rdquo;</p>
            <dl className="ui mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-muted">Gold</dt>
              <dd className="m-0">
                <span className="code bg-ok-soft px-1 text-ok">{describeGold(x.gold)}</span>
              </dd>
              <dt className="text-muted">Got</dt>
              <dd className="m-0">
                <span className="code bg-bad-soft px-1 text-bad">{describeGot(x.got)}</span>
              </dd>
              {x.note && (
                <>
                  <dt className="text-muted">Note</dt>
                  <dd className="m-0 text-muted">{x.note}</dd>
                </>
              )}
            </dl>
          </li>
        ))}
      </ul>

      {/* ---------- seeded bugs ---------- */}
      <h3 className="ui mt-8 text-[15px] font-semibold tracking-normal">Seeded bugs in SYN-EXP-012 v2</h3>
      <p className="ui mt-1 text-[13px] text-muted">
        Gold obligation {v.obligation.id} (para {v.obligation.clause}): <span className="code">{v.obligation.metric}</span> {v.obligation.operator}{" "}
        {v.obligation.threshold}, scope {v.obligation.scope.join(", ")}, span &ldquo;{v.obligation.span}&rdquo;.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="ui w-full min-w-[720px] border-collapse text-[13px]">
          <caption className="sr-only">Seeded bugs and the checks or tests that caught each one</caption>
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="px-3 py-2 font-normal">Bug</th>
              <th scope="col" className="px-3 py-2 font-normal">Result</th>
              <th scope="col" className="px-3 py-2 font-normal">Static check</th>
              <th scope="col" className="px-3 py-2 font-normal">Failing generated tests</th>
            </tr>
          </thead>
          <tbody>
            {[...v.results, v.control].map((b) => {
              const isControl = b.id === "CONTROL";
              const good = isControl ? !b.caught : b.caught;
              return (
                <tr key={b.id} className="align-top odd:bg-surface">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="font-semibold">{b.id}</span> {b.label}
                    <span className="block text-muted">{b.consequence}</span>
                  </th>
                  <td className="px-3 py-2">
                    <span className={`inline-block whitespace-nowrap px-2 py-0.5 text-[12px] font-semibold ${good ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                      {isControl ? (b.caught ? "Wrongly flagged" : "Not flagged") : b.caught ? "Caught" : "Missed"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {b.staticCodes.length ? (
                      <>
                        <span className="font-semibold">{b.staticCodes.join(" + ")}</span>
                        <span className="block text-muted">{b.staticDetail.join("; ")}</span>
                      </>
                    ) : (
                      <span className="text-muted">none</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {b.failingTests.length ? (
                      <ul className="m-0 p-0">
                        {b.failingTests.map((t) => (
                          <li key={t.name} className="list-none">
                            {t.name} <span className="num text-muted">({t.given}: expected {t.expectFire ? "fire" : "no fire"}, {t.fired ? "fired" : "silent"})</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">
                        none{b.testsRun ? ` of ${b.testsRun} failed` : ""}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {v.missed.length > 0 && (
        <p className="ui mt-2 bg-bad-soft px-3 py-2 text-[13px] text-bad">
          Missed: {v.missed.map((m) => `${m.id} ${m.label}`).join("; ")}
        </p>
      )}
    </section>
  );
}
