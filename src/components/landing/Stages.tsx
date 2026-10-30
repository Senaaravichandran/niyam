"use client";

import { useState } from "react";
import { Synthetic } from "./Fragments";

const CLAUSES: [string, string, "applies" | "not_applicable" | "informational"][] = [
  ["1", "Short title and commencement", "informational"],
  ["2", "Applicability", "informational"],
  ["3", "Definitions", "informational"],
  ["4(a)", "Single counterparty exceeding 10%", "applies"],
  ["4(b)", "Group exposure exceeding 12%", "applies"],
  ["4(c)", "Top 20 borrowers not above 40%", "applies"],
  ["5", "Board oversight within 30 days", "applies"],
  ["6", "Upper Layer NBFCs only", "not_applicable"],
  ["7", "Repeal and saving", "informational"],
];

const TAG = {
  applies: ["Applies", "bg-ok-soft text-ok"],
  not_applicable: ["Not for UCB", "bg-warn-soft text-warn"],
  informational: ["Informational", "bg-surface text-muted"],
} as const;

function ReadUI() {
  return (
    <div data-ui className="bg-bg">
      <div className="flex items-center justify-between border-b border-surface-2 px-4 py-2.5 text-[12.5px] text-muted" /* taste-skill-ignore: interface fragment chrome (data-ui) */>
        <span>Reader · RBI-SYN-2026-017 for a UCB</span>
        <Synthetic />
      </div>
      <ul className="m-0 p-0">
        {CLAUSES.map(([n, t, a]) => (
          <li key={n} className={`flex list-none items-center gap-3 px-4 py-[7px] text-[13.5px] ${n === "4(b)" ? "bg-accent-soft" : ""}`}>
            <span className="num w-9 font-semibold text-ink">{n}</span>
            <span className="flex-1 truncate text-ink">{t}</span>
            <span className={`shrink-0 px-2 py-0.5 text-[12px] ${TAG[a][1]}`}>{TAG[a][0]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProveUI() {
  return (
    <div data-ui className="bg-bg">
      <div className="flex items-center justify-between border-b border-surface-2 px-4 py-2.5 text-[12.5px] text-muted" /* taste-skill-ignore: interface fragment chrome (data-ui) */>
        <span>A2A task · Validator → Author</span>
        <span className="font-semibold text-bad">Objection</span>
      </div>
      <div className="space-y-3 p-4 text-[13.5px]">
        <p className="font-semibold text-ink">OBJ-EXP-012-01 · OP-FIDELITY + POLICY-OVERRIDE</p>
        <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2">
          <span className="text-muted">Clause</span>
          <span className="text-ink">4(b) says “exceeding”: strictly greater, equality does not trigger</span>
          <span className="text-muted">Expected</span>
          <span className="text-ok">op “&gt;”, no Board exception (para 5)</span>
          <span className="text-muted">Found</span>
          <span className="text-bad">op “&gt;=”, unless: board_approved</span>
          <span className="text-muted">Evidence</span>
          <span className="text-ink">At exactly 12.00% the draft fires; a Board-approved group at 14% stays quiet</span>
        </div>
        <p className="bg-ok-soft px-3 py-2 text-ok">Author revised and recommitted. 14 of 14 tests pass.</p>
      </div>
    </div>
  );
}

function SignUI() {
  const signers = [
    ["A. Menon", "Chief Compliance Officer"],
    ["R. Iyer", "Head of Risk and IT Change"],
  ];
  return (
    <div data-ui className="bg-bg">
      <div className="flex items-center justify-between border-b border-surface-2 px-4 py-2.5 text-[12.5px] text-muted" /* taste-skill-ignore: interface fragment chrome (data-ui) */>
        <span>Approval pack · SYN-EXP-012 v2</span>
        <Synthetic />
      </div>
      <div className="space-y-2 p-4">
        {signers.map(([n, r]) => (
          <div key={n} className="bg-surface px-3 py-2.5 text-[13px]">
            <div className="flex justify-between">
              <span className="font-semibold text-ink">{n}</span>
              <span className="text-ok">Signed</span>
            </div>
            <p className="text-muted">{r}</p>
            <p className="code mt-1 truncate text-[12px] text-ink">HMAC-SHA256 · rule sha256 e0a3907c91c0349e…</p>
          </div>
        ))}
        <p className="pt-1 text-[13px] text-muted">Change one byte of the rule and both tokens stop verifying. The deploy API refuses it.</p>
      </div>
    </div>
  );
}

const DAYS = [
  ["shadow", 7], // taste-skill-ignore: shadow mode, not a box shadow
  ["shadow", 7], // taste-skill-ignore: shadow mode, not a box shadow
  ["shadow", 7], // taste-skill-ignore: shadow mode, not a box shadow
  ["canary", 7],
  ["canary", 7],
  ["canary", 7],
  ["canary", 7],
  ["live", 6],
  ["live", 7],
  ["live", 12],
] as const;

function WatchUI() {
  const max = 13;
  const band: [number, number] = [3.2, 9.0];
  return (
    <div data-ui className="bg-bg">
      <div className="flex items-center justify-between border-b border-surface-2 px-4 py-2.5 text-[12.5px] text-muted" /* taste-skill-ignore: interface fragment chrome (data-ui) */>
        <span>Sentinel · SYN-EXP-012 daily alerts</span>
        <span className="font-semibold text-bad">Rolled back to v1</span>
      </div>
      <div className="p-4">
        <div className="relative h-[150px]">
          <div
            className="absolute inset-x-0 bg-ok-soft"
            style={{ bottom: `${(band[0] / max) * 100}%`, height: `${((band[1] - band[0]) / max) * 100}%` }}
            title="Forecast band from the 90-day backtest"
          />
          <div className="absolute inset-0 flex items-end gap-[6px]">
            {DAYS.map(([phase, n], i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className={`num text-[11px] ${i === 9 ? "font-semibold text-bad" : "text-muted"}`}>{n}</span>
                <div
                  className={i === 9 ? "w-full bg-bad" : phase === "shadow" ? "w-full bg-surface-2" : phase === "canary" ? "w-full bg-[#9db4ee]" : "w-full bg-accent"} /* taste-skill-ignore: "shadow" is the rollout phase */
                  style={{ height: `${(n / max) * 118}px` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[12px] text-muted">
          <span>Days 1–3 shadow</span>
          <span>4–7 canary 10%</span>
          <span>8–10 live</span>
        </div>
        <p className="mt-3 bg-bad-soft px-3 py-2 text-[13px] text-bad">
          Day 10: the loan feed loaded twice. 12 alerts against a band of 3.2 to 9.0 (z = 6.1). Flag off and git revert in one step.
        </p>
      </div>
    </div>
  );
}

const STAGES = [
  {
    name: "Read",
    title: "First, read every clause",
    body: "The Reader splits the circular at its own numbering and decides, for this bank's licence, which paragraphs bind it and why.",
    ui: <ReadUI />,
  },
  {
    name: "Prove",
    title: "Then prove the rule",
    body: "The Author drafts; the Validator, built separately, tests the draft against the clause and objects over A2A until it holds.",
    ui: <ProveUI />,
  },
  {
    name: "Sign",
    title: "Then sign it twice",
    body: "Two named people in two roles sign the exact file. Their tokens are bound to its hash, so nothing can change after they sign.",
    ui: <SignUI />,
  },
  {
    name: "Watch",
    title: "Finally, watch it live",
    body: "Shadow, then 10% canary, then live. A Sentinel compares each day with the backtest forecast and rolls back on a breach.",
    ui: <WatchUI />,
  },
];

export function Stages() {
  const [i, setI] = useState(0);
  const s = STAGES[i];
  return (
    <section id="how" className="scroll-mt-16" aria-labelledby="stages-title">
      <h2 id="stages-title" className="sr-only">
        How NIYAM works
      </h2>
      <div className="grid min-h-[88svh] grid-cols-1 lg:grid-cols-2">
        <div className="order-2 flex flex-col justify-between bg-surface px-[var(--margin)] pb-10 pt-12 lg:order-1 lg:pt-16">
          <div key={s.name} className="rise">
            <p className="ui text-[clamp(36px,4.4vw,72px)] font-bold leading-[0.98] tracking-[-0.035em] text-ink">{s.title}</p>
            <p className="mt-6 max-w-[44ch] text-[18px] text-ink">{s.body}</p>
          </div>
        </div>
        <div className="order-1 flex items-center justify-center bg-surface-2 px-4 py-10 lg:order-2">
          <div key={s.name} className="rise w-full max-w-[460px]">
            {s.ui}
          </div>
        </div>
      </div>
      <div className="relative bg-surface px-[var(--margin)] pb-10">
        <div aria-hidden className="absolute inset-y-0 right-0 hidden w-1/2 bg-surface-2 lg:block" />
        <div className="relative">
        <label htmlFor="stage" className="sr-only">
          Stage
        </label>
        <input
          id="stage"
          type="range"
          min={0}
          max={STAGES.length - 1}
          step={1}
          value={i}
          onChange={(e) => setI(Number(e.target.value))}
          className="stage-range w-full"
          style={{ ["--p" as string]: `${(i / (STAGES.length - 1)) * 100}%` }}
          aria-valuetext={`${STAGES[i].name}: ${STAGES[i].title}`}
        />
        <div className="ui relative mt-3 h-7 text-[16px]">
          {STAGES.map((st, k) => {
            const pct = (k / (STAGES.length - 1)) * 100;
            const shift = k === 0 ? "0%" : k === STAGES.length - 1 ? "-100%" : "-50%";
            return (
              <button
                key={st.name}
                type="button"
                onClick={() => setI(k)}
                style={{ left: `calc(${pct}% + ${16 - (32 * pct) / 100}px)`, transform: `translateX(${k === 0 ? "-16px" : k === STAGES.length - 1 ? "16px" : "0px"}) translateX(${shift})` }}
                className={`absolute top-0 cursor-pointer bg-transparent p-0 transition-colors ${k === i ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
              >
                {st.name}
              </button>
            );
          })}
        </div>
        </div>
      </div>
    </section>
  );
}
