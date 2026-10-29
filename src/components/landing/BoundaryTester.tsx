"use client";

import { useState } from "react";

/**
 * The one live thing: drag a group's exposure across the 12% limit and see what each version of
 * the rule does. Clause 4(b) says "exceeding", so at exactly 12.00% the correct rule stays quiet.
 */
export function BoundaryTester() {
  const [v, setV] = useState(1200);
  const value = v / 100;
  const strict = value > 12;
  const copied = value >= 12;
  const disagree = strict !== copied;

  return (
    <section className="bg-surface" aria-labelledby="tester-title">
      <div className="wrap flex min-h-[88svh] flex-col justify-between py-16 lg:py-20">
        <div>
          <h2 id="tester-title" className="max-w-[20ch] text-[clamp(28px,3vw,44px)]">
            Where does “exceeding” begin?
          </h2>
          <div data-ui className="mt-7 w-full max-w-[400px] bg-bg p-4">
            <div className="flex items-baseline justify-between text-[13px] text-muted">
              <label htmlFor="exposure">Group exposure, % of Tier 1</label>
              <span className="num font-semibold text-ink">{value.toFixed(2)}%</span>
            </div>
            <input
              id="exposure"
              type="range"
              min={1100}
              max={1300}
              step={1}
              value={v}
              onChange={(e) => setV(Number(e.target.value))}
              className="stage-range mt-2 w-full"
              style={{ ["--p" as string]: `${((v - 1100) / 200) * 100}%` }}
              aria-valuetext={`${value.toFixed(2)} per cent`}
            />
            <div className="mt-1 flex justify-between text-[12px] text-muted">
              <span>11.00%</span>
              <button type="button" onClick={() => setV(1200)} className="cursor-pointer bg-transparent p-0 text-accent underline underline-offset-2">
                Set to exactly 12.00%
              </button>
              <span>13.00%</span>
            </div>
          </div>
        </div>

        <div className="mt-16 grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <p className="ui num font-bold leading-[0.8] tracking-[-0.05em] text-ink" style={{ fontSize: "clamp(110px, 19vw, 320px)" }} aria-live="polite">
            {value.toFixed(2)}
            <span className="align-baseline font-bold" style={{ fontSize: "0.2em", marginLeft: "0.12em", letterSpacing: "-0.01em" }}>
              per cent
            </span>
          </p>
          <div className="max-w-[34ch] space-y-3 pb-3">
            <p className={`ui flex items-center justify-between gap-4 px-3 py-2 text-[16px] ${strict ? "bg-accent text-white" : "bg-bg text-ink"}`}>
              <span>
                NIYAM rule, <b>&gt; 12</b>
              </span>
              <b>{strict ? "Fires" : "Quiet"}</b>
            </p>
            <p className={`ui flex items-center justify-between gap-4 px-3 py-2 text-[16px] ${copied ? (disagree ? "bg-bad text-white" : "bg-accent text-white") : "bg-bg text-ink"}`}>
              <span>
                Copied rule, <b>&gt;= 12</b>
              </span>
              <b>{copied ? "Fires" : "Quiet"}</b>
            </p>
            <p className="text-[17px] text-ink">
              {disagree
                ? "Here the two disagree. The clause says exceeding, so a group at exactly the limit must not be flagged. NIYAM's Validator generates this exact case and blocks the copied rule."
                : "Clause 4(b) flags exposure exceeding 12 per cent. Drag to exactly 12.00% to see the one point where a copied >= rule goes wrong."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
