"use client";

import { useEffect, useMemo, useState } from "react";
import YAML from "yaml";
import { EXISTING_RULES } from "@/niyam/data/seed";
import type { RunState } from "./state";

/**
 * Counterfactual threshold explorer. For one drafted rule, varies only the threshold and replays
 * the same compiled SQL over the same 90-day SYNTHETIC book (POST /api/whatif). No LLM involved.
 */

interface WhatIfPoint {
  threshold: number;
  alerts: number;
  subjects: number;
  analystHours: number;
}

interface WhatIfResponse {
  ruleId: string;
  title: string;
  metric: string;
  op: string;
  value: number;
  oldValue: number | null;
  minutesPerAlert: number;
  days: number;
  points: WhatIfPoint[];
}

const OP_WORDS: Record<string, string> = {
  ">": "above",
  ">=": "at or above",
  "<": "below",
  "<=": "at or below",
  "==": "exactly at",
};

const fmtPct = (x: number) => `${x.toFixed(1)}%`;
const fmtInt = (x: number) => x.toLocaleString("en-IN");
const fmtHours = (x: number) => (Number.isInteger(x) ? fmtInt(x) : x.toFixed(1));

function draftValue(yaml: string): number | null {
  try {
    const v = (YAML.parse(yaml) as { when?: { value?: unknown } } | null)?.when?.value;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function signed(n: number) {
  if (n === 0) return "±0";
  return `${n > 0 ? "+" : "−"}${fmtInt(Math.abs(n))}`;
}

export function WhatIf({ s }: { s: RunState }) {
  const drafts = useMemo(() => s.bundle?.drafts ?? [], [s.bundle]);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, WhatIfResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<Record<string, number>>({});

  const selected = drafts.find((d) => d.ruleId === ruleId) ?? drafts[0];
  const oldValue = selected ? EXISTING_RULES.find((r) => r.rule_id === selected.ruleId)?.when.value ?? null : null;
  const cacheKey = selected ? `${selected.ruleId}@${selected.version}:${selected.yaml.length}` : "";
  const data = cacheKey ? cache[cacheKey] : undefined;

  useEffect(() => {
    if (!selected || cache[cacheKey]) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/whatif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yaml: selected.yaml, ...(oldValue != null ? { oldValue } : {}) }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.issues?.join("; ") || json?.error || `${res.status}`);
        setLoading(false);
        setCache((c) => ({ ...c, [cacheKey]: json as WhatIfResponse }));
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setLoading(false);
        setError(e.message);
      });
    return () => ctrl.abort();
  }, [selected, cacheKey, cache, oldValue]);

  if (!s.bundle || !selected) {
    return (
      <div data-ui>
        <p className="ui bg-surface px-4 py-6 text-[14px] text-muted">
          The threshold explorer opens once the approval pack is ready. It replays each drafted rule at other thresholds on the same synthetic book.
        </p>
      </div>
    );
  }

  const regValue = data?.value ?? draftValue(selected.yaml);
  const points = data?.points ?? [];
  const regIndex = Math.max(
    0,
    points.findIndex((p) => p.threshold === regValue),
  );
  const index = Math.min(pick[cacheKey] ?? regIndex, Math.max(points.length - 1, 0));
  const cur = points[index];
  const reg = points[regIndex];
  const max = Math.max(1, ...points.map((p) => p.alerts));
  const pct = points.length > 1 ? (index / (points.length - 1)) * 100 : 0;
  const opWord = OP_WORDS[data?.op ?? ""] ?? data?.op ?? "";
  const days = data?.days ?? 90;

  const dAlerts = cur && reg ? cur.alerts - reg.alerts : 0;
  const dPct = cur && reg && reg.alerts ? (dAlerts / reg.alerts) * 100 : null;
  const dHours = cur && reg ? Math.round((cur.analystHours - reg.analystHours) * 10) / 10 : 0;

  return (
    <div data-ui className="bg-bg">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="ui flex flex-col gap-1 text-[12.5px] text-muted">
          Rule
          <select
            className="ui bg-surface px-3 py-2 text-[14px] text-ink"
            style={{ borderRadius: 0 }}
            value={selected.ruleId}
            onChange={(e) => setRuleId(e.target.value)}
          >
            {drafts.map((d) => (
              <option key={d.ruleId} value={d.ruleId}>
                {d.ruleId} v{d.version} · {d.title}
              </option>
            ))}
          </select>
        </label>
        <span className="ui bg-surface px-2 py-0.5 text-[12px] font-semibold text-muted">SYNTHETIC book · {days} days</span>
      </div>

      <p className="mt-3 text-[15px] leading-[1.55] text-ink" style={{ fontFamily: "var(--font-text)" }}>
        What if the circular had said {cur ? fmtPct(cur.threshold) : "something else"}? Same synthetic {days}-day book, same compiled SQL, threshold varied.
      </p>

      {error && (
        <p role="alert" className="ui mt-3 bg-bad-soft px-3 py-2 text-[13px] text-bad">
          Could not run the sweep: {error}
        </p>
      )}

      {!data && !error && (
        <p className="ui mt-3 bg-surface px-4 py-6 text-[14px] text-muted" aria-live="polite">
          {loading ? "Replaying the rule at each threshold…" : "Preparing the sweep…"}
        </p>
      )}

      {data && cur && (
        <>
          <div className="mt-4" aria-live="polite">
            <p className="ui text-[13px] text-muted">
              {data.ruleId} fires {opWord} the threshold. At <span className="num font-semibold text-ink">{fmtPct(cur.threshold)}</span>:
            </p>
            <dl className="mt-1 grid grid-cols-3 gap-px bg-surface-2">
              <div className="bg-bg py-2 pr-3">
                <dt className="ui text-[12px] text-muted">alerts over {days} days</dt>
                <dd className="num m-0 text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] font-semibold leading-none tracking-[-0.03em] text-ink">{fmtInt(cur.alerts)}</dd>
              </div>
              <div className="bg-bg px-3 py-2">
                <dt className="ui text-[12px] text-muted">subjects flagged</dt>
                <dd className="num m-0 text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] font-semibold leading-none tracking-[-0.03em] text-ink">{fmtInt(cur.subjects)}</dd>
              </div>
              <div className="bg-bg px-3 py-2">
                <dt className="ui text-[12px] text-muted">analyst hours at {data.minutesPerAlert} min</dt>
                <dd className="num m-0 text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] font-semibold leading-none tracking-[-0.03em] text-ink">{fmtHours(cur.analystHours)}</dd>
              </div>
            </dl>
            <p className="ui mt-2 text-[13px] text-muted">
              {index === regIndex ? (
                <>This is the value the circular sets.</>
              ) : (
                <>
                  Versus the circular&apos;s {fmtPct(data.value)}:{" "}
                  <span className={`num font-semibold ${dAlerts > 0 ? "text-bad" : dAlerts < 0 ? "text-ok" : "text-ink"}`}>
                    {signed(dAlerts)} alerts{dPct != null && dAlerts !== 0 ? ` (${dPct > 0 ? "+" : "−"}${Math.abs(Math.round(dPct))}%)` : ""}
                  </span>
                  , <span className="num font-semibold text-ink">{dHours > 0 ? "+" : dHours < 0 ? "−" : ""}{fmtHours(Math.abs(dHours))}</span> analyst hours,{" "}
                  <span className="num font-semibold text-ink">{signed(cur.subjects - (reg?.subjects ?? 0))}</span> subjects.
                </>
              )}
            </p>
          </div>

          <div
            role="img"
            aria-label={`Alerts over ${days} days by threshold for ${data.ruleId}: ${points.map((p) => `${fmtPct(p.threshold)} ${p.alerts}`).join(", ")}`}
            className="mt-4"
          >
            <div className="flex h-[184px] items-end gap-[3px] pt-4" aria-hidden="true">
              {points.map((p, i) => {
                const isReg = p.threshold === data.value;
                const isOld = data.oldValue != null && p.threshold === data.oldValue;
                const isCur = i === index;
                const tone = isReg ? "bg-accent" : isOld ? "bg-ink" : isCur ? "bg-muted" : "bg-surface-2";
                const h = p.alerts ? Math.max(2, (p.alerts / max) * 100) : 0;
                return (
                  <div key={p.threshold} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                    <div className={`${tone} relative w-full transition-[height] duration-300`} style={{ height: `${h}%` }}>
                      {(isCur || isReg || isOld) && (
                        <span className={`num ui absolute bottom-full left-1/2 -translate-x-1/2 pb-0.5 text-[10.5px] leading-tight whitespace-nowrap ${isCur ? "font-semibold text-ink" : "text-muted"}`}>
                          {fmtInt(p.alerts)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px] pt-1" aria-hidden="true">
              {points.map((p, i) => (
                <div key={p.threshold} className="min-w-0 flex-1">
                  <div className={`h-[3px] ${i === index ? "bg-ink" : "bg-transparent"}`} />
                  <span className={`num ui block truncate text-center text-[10.5px] ${i === index ? "font-semibold text-ink" : "text-muted"}`}>
                    {p.threshold % 1 === 0 ? p.threshold : p.threshold.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <input
            type="range"
            className="stage-range mt-2 w-full"
            min={0}
            max={Math.max(points.length - 1, 0)}
            step={1}
            value={index}
            onChange={(e) => setPick((p) => ({ ...p, [cacheKey]: Number(e.target.value) }))}
            aria-label={`Threshold for ${data.ruleId}`}
            aria-valuetext={`${fmtPct(cur.threshold)}: ${cur.alerts} alerts`}
            style={{ "--p": `${pct}%` } as React.CSSProperties}
          />

          <ul className="ui m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] text-muted">
            <li className="flex list-none items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 bg-accent" aria-hidden="true" /> Circular value {fmtPct(data.value)}
            </li>
            {data.oldValue != null && data.oldValue !== data.value && (
              <li className="flex list-none items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 bg-ink" aria-hidden="true" /> Live v1 value {fmtPct(data.oldValue)}
              </li>
            )}
            <li className="flex list-none items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 bg-surface-2" aria-hidden="true" /> Counterfactual
            </li>
            <li className="list-none">Synthetic data. Analyst hours assume {data.minutesPerAlert} minutes per alert.</li>
          </ul>
        </>
      )}
    </div>
  );
}
