"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ENTITY_LABEL } from "@/niyam/data/bankProfile";
import { initialState, reducer, type RunState } from "@/components/console/state";
import type { RunEvent } from "@/niyam/events";
import { CONSOLE_ORIGINS, isRelayMessage, type BankSiteDef, type LlmSummary, type RelayMessage } from "./relay";

/**
 * A bank's own rule-engine operations site. When NIYAM releases a change, the console that opened
 * this page streams every event here; the page plays them back at a pace a presenter can talk
 * over, with a caption for each step, the old and new rule side by side, the Sentinel, the people
 * who signed, how the release was made, and the Golden Thread revealed link by link.
 */

const STORE = (k: string) => `niyam-bank-${k}-release`;

function trusted(origin: string) {
  return CONSOLE_ORIGINS.includes(origin) || origin === window.location.origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

const opOf = (yaml: string) => yaml.match(/op: "([^"]+)"/)?.[1] ?? "";
const valOf = (yaml: string) => yaml.match(/value: ([\d.]+)/)?.[1] ?? "";

interface Caption {
  stage: string;
  text: string;
  sub?: string;
  tone?: "ok" | "bad" | "plain";
}

/** How long each kind of event holds the screen at 1× speed, in milliseconds. */
function holdFor(m: RelayMessage): number {
  if (m.kind === "init") return 3200;
  if (m.kind !== "event") return 0;
  const e = m.event;
  switch (e.type) {
    case "approvals_verified":
      return 3600;
    case "promote":
      return 2600;
    case "rollout":
      return 3200;
    case "day":
      return 3000;
    case "rollback":
      return 5200;
    case "thread":
      return 9000;
    default:
      return 0;
  }
}

/** The caption a presenter can read out for each event, or null to keep the current one. */
function captionFor(m: RelayMessage, s: RunState, bankName: string, lastPhase: string | null): Caption | null {
  if (m.kind === "init") {
    const names = [...new Set(m.approvals.map((a) => a.payload.approver_name))];
    return {
      stage: "Release received",
      text: `NIYAM has sent ${m.bundle.drafts.length} rule change${m.bundle.drafts.length === 1 ? "" : "s"} for ${bankName}, from circular ${m.bundle.circularRef}.`,
      sub: `Signed by ${names.join(" and ") || "two approvers"}. Nothing changes for customers yet: first, the signatures are checked.`,
    };
  }
  if (m.kind !== "event") return null;
  const e: RunEvent = m.event;
  switch (e.type) {
    case "approvals_verified":
      return e.ok
        ? { stage: "Signatures verified", text: "Both signatures match the exact rule files that arrived.", sub: "Each token covers the SHA-256 of the file, the approver, their role and their reason. Change one character and this check fails.", tone: "ok" }
        : { stage: "Release refused", text: `Refused: ${e.reason ?? "the approvals did not verify"}.`, sub: "Nothing was installed and no switch changed.", tone: "bad" };
    case "promote":
      return { stage: "Installed, switched off", text: `The new rules are merged to main as commit ${e.commit}, behind a switch that is still off.`, sub: "Next they earn their way in: shadow, then canary, then live." };
    case "rollout":
      if (e.state.mode === lastPhase || e.state.mode === "off") return null;
      if (e.state.mode === "shadow") return { stage: "Stage 1 · Shadow", text: "Shadow mode: the new rules run on today's live data but only write to a log.", sub: "They block nothing. The old rules still decide every case, so we can compare the two safely." };
      if (e.state.mode === "canary") return { stage: "Stage 2 · Canary", text: "Canary: the new rules now decide for 10% of customers, picked by a stable hash.", sub: "The other 90% stay on the old rules. The Sentinel compares every day with the backtest forecast." };
      if (e.state.mode === "live") return { stage: "Stage 3 · Live", text: "Live: the new rules now decide for every customer.", sub: "The Sentinel keeps watching every day." };
      return null;
    case "day": {
      const d = e.day;
      const rules = Object.entries(d.perRule);
      const v1 = rules.reduce((n, [, r]) => n + (r.v1 ?? 0), 0);
      const v2 = rules.reduce((n, [rid, r]) => n + (r.mode.startsWith("rolled_back") || s.rollbacks.some((x) => x.ruleId === rid) ? 0 : r.observed), 0);
      const acted = rules.reduce((n, [, r]) => n + (r.enforced ?? 0), 0);
      const drift = rules.filter(([, r]) => r.drift).map(([rid]) => rid);
      const where = d.phase === "shadow" ? "would have raised" : "raised";
      return {
        stage: `Day ${d.index} · ${d.phase === "shadow" ? "Shadow" : d.phase === "canary" ? "Canary 10%" : "Live"}`,
        text: `Old rules raised ${v1} alert${v1 === 1 ? "" : "s"}; the new rules ${where} ${v2}.`,
        sub: `${
          d.phase === "shadow"
            ? "Shadow: none of the new alerts touched a customer."
            : d.phase === "canary"
              ? `Canary: ${acted} of the new alerts fell on customers in the 10% canary and took effect; everyone else stayed on the old rules.`
              : `Live: ${acted} new alert${acted === 1 ? "" : "s"} took effect.`
        } ${drift.length ? `Outside the forecast band for ${drift.join(", ")}: the Sentinel is stepping in.` : "Every rule is inside its forecast band."}`,
        tone: drift.length ? "bad" : "plain",
      };
    }
    case "rollback":
      return { stage: "Sentinel · automatic rollback", text: `The Sentinel switched ${e.ruleId} off and reverted it to v${e.toVersion} (commit ${e.commit}).`, sub: `${e.reason}. Switching it back on is a human decision.`, tone: "bad" };
    case "thread":
      return { stage: "Golden Thread", text: `Why did alert ${e.thread.alert.id} fire? Follow it back to the exact sentence.`, sub: "Alert, rule version, the two approvers, the obligation, the clause, the circular." };
    default:
      return null;
  }
}

/** Reveals text a few characters at a time, like someone typing it. */
function Typed({ text, speed }: { text: string; speed: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const step = Math.max(1, Math.round(2 * speed));
    const t = setInterval(() => setN((x) => (x >= text.length ? (clearInterval(t), x) : Math.min(text.length, x + step))), 28);
    return () => clearInterval(t);
  }, [text, speed]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[2px] animate-pulse bg-white/80" aria-hidden="true" />}
    </>
  );
}

const STAGES = [
  { phase: "shadow", title: "Shadow", sub: "Days 1-3 · logs only", pct: "0% of decisions" },
  { phase: "canary", title: "Canary", sub: "Days 4-7 · 10% of customers", pct: "10% of decisions" },
  { phase: "live", title: "Live", sub: "Day 8 on · everyone", pct: "100% of decisions" },
] as const;

export function BankSite({ bank: initialBank }: { bank: BankSiteDef }) {
  const [bank, setBank] = useState<BankSiteDef>(initialBank);
  const [s, setS] = useState<RunState>(initialState);
  const [caption, setCaption] = useState<Caption | null>(null);
  const [llm, setLlm] = useState<LlmSummary | undefined>();
  const [path, setPath] = useState<string | undefined>();
  const [link, setLink] = useState<"waiting" | "connected" | "restored">("waiting");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [threadStep, setThreadStep] = useState(0);
  const log = useRef<RelayMessage[]>([]);
  const queue = useRef<RelayMessage[]>([]);
  const busy = useRef(false);
  const state = useRef<RunState>(initialState);
  const lastPhase = useRef<string | null>(null);
  const [tick, setTick] = useState(0);
  const bankName = useRef(initialBank.short);

  const apply = useCallback(
    (m: RelayMessage) => {
      let next = state.current;
      if (m.kind === "init") {
        next = reducer({ ...initialState, status: "awaiting", bundle: m.bundle, approvals: m.approvals }, { type: "start_release" });
        lastPhase.current = null;
        setThreadStep(0);
        if (m.bankDef && m.bankDef.key === initialBank.key) {
          setBank(m.bankDef);
          bankName.current = m.bankDef.short;
        }
        setLlm(m.llm);
        setPath(m.path);
      } else if (m.kind === "event") {
        next = reducer(next, { type: "event", event: m.event });
      }
      const c = captionFor(m, next, bankName.current, lastPhase.current);
      if (m.kind === "event" && m.event.type === "rollout" && m.event.state.mode !== "off") lastPhase.current = m.event.state.mode;
      state.current = next;
      setS(next);
      if (c) setCaption(c);
      return holdFor(m);
    },
    [initialBank.key],
  );

  // The player: one message at a time, each held for its time on screen. A single timer, kept in
  // a ref, so messages that keep arriving from the console never cut a step short.
  const timer = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const pump = useCallback(() => {
    if (pausedRef.current || timer.current !== null) return;
    const m = queue.current.shift();
    if (!m) {
      setTick((x) => x + 1);
      return;
    }
    const prevPhase = lastPhase.current;
    const hold = apply(m);
    const isRollout = m.kind === "event" && m.event.type === "rollout";
    const isPhaseChange = isRollout && m.kind === "event" && m.event.type === "rollout" && m.event.state.mode !== prevPhase;
    const wait = (isRollout && !isPhaseChange ? 250 : hold) / speedRef.current;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      pump();
    }, wait);
  }, [apply]);
  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) pump();
  }, [paused, pump]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  // Golden Thread: reveal one link of the chain at a time.
  useEffect(() => {
    if (!s.thread || threadStep >= 6) return;
    const t = setTimeout(() => setThreadStep((x) => x + 1), 1300 / speed);
    return () => clearTimeout(t);
  }, [s.thread, threadStep, speed]);

  const enqueue = useCallback(
    (m: RelayMessage) => {
      queue.current.push(m);
      pump();
    },
    [pump],
  );

  const replay = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    queue.current = [...log.current];
    state.current = initialState;
    lastPhase.current = null;
    setS(initialState);
    setCaption(null);
    setThreadStep(0);
    setPaused(false);
    pausedRef.current = false;
    pump();
  }, [pump]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE(initialBank.key)) ?? "null") as RelayMessage[] | null;
      if (Array.isArray(saved) && saved.length) {
        log.current = saved;
        // Show the finished state straight away; Replay plays it again.
        let st = initialState;
        for (const m of saved) {
          if (m.kind === "init") {
            st = reducer({ ...initialState, status: "awaiting", bundle: m.bundle, approvals: m.approvals }, { type: "start_release" });
            if (m.bankDef && m.bankDef.key === initialBank.key) {
              setBank(m.bankDef);
              bankName.current = m.bankDef.short;
            }
            setLlm(m.llm);
            setPath(m.path);
          } else if (m.kind === "event") st = reducer(st, { type: "event", event: m.event });
        }
        state.current = st;
        setS(st);
        setThreadStep(6);
        setCaption({ stage: "Last release", text: "This is the last release NIYAM sent to this bank in this browser.", sub: "Press Replay to watch it again, step by step." });
        setLink("restored");
      }
    } catch {
      // Storage unavailable: start empty.
    }
    const onMessage = (e: MessageEvent) => {
      if (!trusted(e.origin) || !isRelayMessage(e.data) || e.data.kind === "ready") return;
      const m = e.data;
      if (m.kind === "init") {
        if (m.bank !== initialBank.key) return;
        log.current = [m];
        queue.current = [];
        state.current = initialState;
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = null;
      } else if (log.current[0]?.kind === "init") log.current.push(m);
      else return;
      setLink("connected");
      enqueue(m);
      try {
        localStorage.setItem(STORE(initialBank.key), JSON.stringify(log.current));
      } catch {
        // Quota or private mode: the live view still works.
      }
    };
    window.addEventListener("message", onMessage);
    window.opener?.postMessage({ niyam: 1, kind: "ready", bank: initialBank.key }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [initialBank.key, enqueue]);

  const last = s.days[s.days.length - 1];
  const stageIdx = last ? STAGES.findIndex((x) => x.phase === last.phase) : -1;
  const done = s.status === "released" && queue.current.length === 0;
  const approvals = Object.values(Object.fromEntries(s.approvals.map((a) => [a.payload.approver_id, a.payload])));
  const drafts = s.bundle?.drafts ?? [];
  const playing = queue.current.length > 0 && !paused;

  return (
    <div className="min-h-svh bg-navy text-on-navy" data-ui>
      <div className="h-1.5" style={{ background: bank.brand }} />
      <header className="wrap flex flex-wrap items-center justify-between gap-4 pb-4 pt-6">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center text-[20px] font-bold text-white" style={{ background: bank.brand }} aria-hidden="true">
            {bank.short.slice(0, 1)}
          </span>
          <div>
            <p className="text-[12.5px] uppercase tracking-[0.08em] text-on-navy-muted">
              {bank.kind} · {ENTITY_LABEL[bank.profile.entityType]} · synthetic
            </p>
            <h1 className="mt-0.5 text-[clamp(24px,2.8vw,38px)] text-white">{bank.short} · Rule engine operations</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 ${link === "connected" ? "bg-white text-ink" : "bg-white/10 text-white"}`}>
            <i className={`inline-block h-2 w-2 ${link === "connected" ? (playing ? "pulse bg-ok" : "bg-ok") : "bg-white/50"}`} />
            {link === "connected" ? "Live link to NIYAM" : link === "restored" ? "Last release" : "Waiting for NIYAM"}
          </span>
          {log.current.length > 0 && (
            <>
              <button type="button" onClick={() => setPaused(!paused)} className="cursor-pointer bg-white/10 px-3 py-1 text-white hover:bg-white/20">
                {paused ? "Play" : "Pause"}
              </button>
              {[0.5, 1, 2].map((x) => (
                <button key={x} type="button" onClick={() => setSpeed(x)} aria-pressed={speed === x} className={`cursor-pointer px-2.5 py-1 ${speed === x ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20"}`}>
                  {x}×
                </button>
              ))}
              <button type="button" onClick={replay} className="cursor-pointer bg-white/10 px-3 py-1 text-white hover:bg-white/20">
                Replay
              </button>
            </>
          )}
        </div>
      </header>

      <main className="wrap space-y-4 pb-16">
        {/* The caption a presenter reads out */}
        <section aria-live="polite" className={`relative overflow-hidden p-6 sm:p-8 ${caption?.tone === "bad" ? "bg-[#4a1520]" : caption?.tone === "ok" ? "bg-[#0f3b33]" : "bg-navy-2"}`}>
          <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: caption?.tone === "bad" ? "#f87171" : caption?.tone === "ok" ? "#6ee7b7" : bank.brand }} />
          {caption ? (
            <div key={caption.stage + caption.text}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#93b4ff]">{caption.stage}</p>
              <p className="mt-2 min-h-[2.4em] text-[clamp(22px,2.6vw,36px)] font-semibold leading-tight text-white">
                <Typed text={caption.text} speed={speed} />
              </p>
              {caption.sub && <p className="rise mt-3 max-w-[90ch] text-[16px] leading-snug text-white/75">{caption.sub}</p>}
            </div>
          ) : (
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#93b4ff]">Waiting</p>
              <p className="mt-2 text-[clamp(22px,2.6vw,36px)] font-semibold leading-tight text-white">Live rules unchanged. Waiting for a release from NIYAM.</p>
              <p className="mt-3 text-[16px] text-white/75">Run the pipeline for {bank.short} in the NIYAM console, sign as maker and checker, and press Release. This page plays the rollout as it happens.</p>
            </div>
          )}
        </section>

        {/* Stages */}
        <section aria-label="Rollout stages" className="grid gap-2 md:grid-cols-3">
          {STAGES.map((st, i) => {
            const now = i === stageIdx && !done;
            const past = i < stageIdx || (done && i <= stageIdx);
            return (
              <div key={st.phase} className={`p-4 ${now ? "bg-white text-ink" : past ? "bg-[#0f3b33] text-white" : "bg-navy-2 text-white/60"}`}>
                <p className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${now ? "text-accent" : "opacity-70"}`}>Stage {i + 1}</p>
                <p className="mt-1 flex items-center gap-2 text-[22px] font-semibold">
                  {now && <i className="pulse inline-block h-2.5 w-2.5" style={{ background: bank.brand }} />}
                  {past && <span aria-hidden="true">✓</span>}
                  {st.title}
                </p>
                <p className="text-[13.5px] opacity-80">{st.sub}</p>
                <p className="mt-1 text-[13px] font-semibold">{st.pct}</p>
              </div>
            );
          })}
        </section>
        <div className="h-1 bg-white/10" aria-hidden="true">
          <div className="h-1 transition-[width] duration-700" style={{ width: `${((last?.index ?? 0) / 12) * 100}%`, background: bank.brand === "#0f4c81" ? "#60a5fa" : bank.brand }} />
        </div>

        {/* Old rule against new rule */}
        <section className="bg-navy-2 p-5">
          <h2 className="text-[22px] text-white">Old rule against new rule</h2>
          <p className="mt-1 text-[14px] text-white/70">Each day: alerts the old rule raises, alerts the new rule raises, and how many the new rule actually acted on.</p>
          {drafts.length === 0 && (
            <ul className="m-0 mt-4 grid gap-2 p-0 md:grid-cols-2">
              {bank.rules.map((r) => (
                <li key={r.rule_id} className="list-none bg-white/5 p-4">
                  <p className="font-semibold text-white">{r.rule_id}</p>
                  <p className="text-[14px] text-white/70">
                    Live (v1): fires when {r.when.metric.replace(/_/g, " ")} {r.when.op} {r.when.value}%
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-3">
            {drafts.map((d) => {
              const old = bank.rules.find((r) => r.rule_id === d.ruleId);
              const roll = s.rollout[d.ruleId];
              const rolled = s.rollbacks.some((r) => r.ruleId === d.ruleId);
              const today = last?.perRule[d.ruleId];
              const max = Math.max(4, ...s.days.map((x) => Math.max(x.perRule[d.ruleId]?.observed ?? 0, x.perRule[d.ruleId]?.v1 ?? 0)));
              return (
                <div key={d.ruleId} className="bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[16px] font-semibold text-white">
                        {d.ruleId} <span className="font-normal text-white/60">{d.title}</span>
                      </p>
                      <p className="mt-1 text-[14px]">
                        {old ? (
                          <>
                            <span className="text-white/60">
                              Old v1: {old.when.op} {old.when.value}%
                              {old.unless ? ", unless Board-approved" : ""}
                            </span>
                            <span className="mx-2 text-white/40">→</span>
                          </>
                        ) : (
                          <span className="mr-2 text-white/60">New rule:</span>
                        )}
                        <span className="font-semibold text-[#93b4ff]">
                          v{d.version}: {opOf(d.yaml)} {valOf(d.yaml)}%
                        </span>
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 text-[12.5px] font-semibold ${rolled ? "bg-[#f87171] text-ink" : roll?.mode === "live" ? "bg-[#6ee7b7] text-ink" : roll?.mode === "canary" ? "bg-[#93b4ff] text-ink" : roll?.mode === "shadow" ? "bg-white/20 text-white" : "bg-white/10 text-white/70"}`}>
                      {rolled ? "Rolled back to v1" : roll ? (roll.mode === "canary" ? `Canary ${roll.canaryPct}%` : roll.mode === "shadow" ? "Shadow · logging only" : roll.mode === "live" ? "Live" : roll.mode) : "Waiting"}
                    </span>
                  </div>
                  {today && (
                    <p className="mt-2 text-[14px] text-white/80">
                      Day {last.index}: old {today.v1 ?? "–"} · new {today.observed} · acted on {today.enforced ?? 0}
                      {today.band[1] > 0 ? ` · forecast ${today.band[0].toFixed(1)} to ${today.band[1].toFixed(1)}` : ""}
                      {today.drift ? " · outside the band" : ""}
                    </p>
                  )}
                  <div className="mt-3 flex h-[96px] items-end gap-2" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, i) => {
                      const day = s.days[i];
                      const r = day?.perRule[d.ruleId];
                      return (
                        <div key={i} className="flex h-full flex-1 items-end gap-[2px]">
                          <div className="flex-1 bg-white/25 transition-[height] duration-700" style={{ height: r?.v1 != null ? `${Math.max(3, (r.v1 / max) * 100)}%` : "0%" }} />
                          <div
                            className={`flex-1 transition-[height] duration-700 ${r?.drift ? "bg-[#f87171]" : r?.mode.startsWith("rolled_back") ? "bg-white/10" : "bg-[#93b4ff]"}`}
                            style={{ height: r ? `${Math.max(3, (r.observed / max) * 100)}%` : "0%" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex gap-2 text-[11px] text-white/50">
                    {Array.from({ length: 12 }, (_, i) => (
                      <span key={i} className="flex-1 text-center">
                        {i + 1}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {drafts.length > 0 && (
              <p className="flex flex-wrap gap-4 text-[12.5px] text-white/60">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 bg-white/25" /> Old rule (v1)
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 bg-[#93b4ff]" /> New rule
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 bg-[#f87171]" /> Outside the forecast band
                </span>
              </p>
            )}
          </div>
          {s.rollbacks.map((r) => (
            <p key={r.ruleId} className="rise mt-3 bg-[#4a1520] p-3 text-[14px] text-white">
              <b>Automatic rollback:</b> {r.ruleId} to v{r.toVersion}, commit {r.commit}. {r.reason}.
            </p>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* How this release was made */}
          <section className="bg-navy-2 p-5">
            <h2 className="text-[22px] text-white">How this release was made</h2>
            {!s.bundle ? (
              <p className="mt-2 text-[14px] text-white/70">Shown when a release arrives.</p>
            ) : path === "llm" ? (
              <div className="mt-3 space-y-3 text-[14.5px] leading-snug text-white/85">
                <p>
                  <b className="text-white">Mode: Claude live.</b> The Extractor and the Author asked Claude{llm?.model ? ` (${llm.model})` : ""} to read the circular and draft the rules.
                </p>
                {llm && (
                  <p className="bg-white/5 p-3 text-[13.5px]">
                    {llm.calls} Claude call{llm.calls === 1 ? "" : "s"} by {llm.agents.join(" and ") || "the agents"} · {llm.inputTokens.toLocaleString()} tokens in, {llm.outputTokens.toLocaleString()} out · about ${llm.costUsd.toFixed(3)}
                  </p>
                )}
                <p>
                  <b className="text-white">How it was checked:</b> an obligation was accepted only if its quote appears word for word in the clause; a rule only if it passed the typed schema, the compiler, the tests written from the circular, and the Validator.
                </p>
                <p>
                  <b className="text-white">Why Claude:</b> it reads wording a fixed rule set has never seen. The checks stop it from inventing anything.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3 text-[14.5px] leading-snug text-white/85">
                <p>
                  <b className="text-white">Mode: rule-based.</b> No language model was used. Comparator phrases (“exceeding” is &gt;, “or more” is &gt;=, “not less than” is a floor) and numbers were matched by rules, and each rule was filled from a typed template.
                </p>
                <p>
                  <b className="text-white">How it was checked:</b> every quote word for word against its clause, then the schema, the compiler, the tests and the Validator.
                </p>
                <p>
                  <b className="text-white">Why rule-based:</b> the same circular always gives the same rules, at no cost, which suits audits and repeat runs.
                </p>
              </div>
            )}
            <p className="mt-3 text-[13px] text-white/60">In both modes, mapping, tests, backtest, approvals, rollout and the Sentinel are deterministic code, and two people sign before anything reaches the bank.</p>
          </section>

          {/* Signed off by */}
          <section className="bg-navy-2 p-5">
            <h2 className="text-[22px] text-white">Signed off by</h2>
            {approvals.length ? (
              <ul className="m-0 mt-3 space-y-2 p-0">
                {approvals.map((p) => (
                  <li key={p.approver_id} className="list-none bg-white/5 p-3">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6ee7b7]">{p.duty ?? "Approver"}</p>
                    <p className="text-[16px] font-semibold text-white">{p.approver_name}</p>
                    <p className="text-[12.5px] text-white/60">
                      {p.role}
                      {p.employee_id ? ` · ${p.employee_id}` : ""} · {new Date(p.issued_at).toLocaleString()}
                    </p>
                    {p.reason && <p className="mt-1 text-[14px] text-white/85">“{p.reason}”</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-white/70">No release yet. Two people must sign in the NIYAM console before anything reaches this bank.</p>
            )}
          </section>
        </div>

        {/* Golden Thread */}
        <section className="bg-navy-2 p-5">
          <h2 className="text-[22px] text-white">Golden Thread</h2>
          {s.thread ? (
            <ol className="m-0 mt-4 space-y-2 p-0">
              {[
                ["Alert", `${s.thread.alert.id} · ${s.thread.alert.subject} at ${s.thread.alert.metricValue.toFixed(2)}% on ${s.thread.alert.day} · ${s.thread.alert.mode}`],
                ["Rule", `${s.thread.rule.ruleId} v${s.thread.rule.version} “${s.thread.rule.title}”${s.thread.rule.commit ? ` · commit ${s.thread.rule.commit}` : ""}`],
                ["Approved by", s.thread.approvals.length ? s.thread.approvals.map((a) => `${a.approver_name} (${a.duty ?? a.role})`).join(" and ") : "Original rule, before NIYAM"],
                ["Obligation", s.thread.obligation ? `${s.thread.obligation.id} · fire when ${s.thread.obligation.metric ?? ""} ${s.thread.obligation.operator ?? ""} ${s.thread.obligation.threshold ?? ""}%` : "None"],
                ["Clause", s.thread.clause ? `Para ${s.thread.clause.number}: “${s.thread.clause.span}”` : "None"],
                ["Circular", `${s.thread.circular.ref} · ${s.thread.circular.title}`],
              ].map(([k, v], i) =>
                i < threadStep ? (
                  <li key={k} className="rise grid list-none gap-2 bg-white/5 p-3 sm:grid-cols-[140px_1fr]">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#93b4ff]">
                      {i + 1}. {k}
                    </span>
                    <span className="text-[15px] text-white">{v}</span>
                  </li>
                ) : null,
              )}
            </ol>
          ) : (
            <p className="mt-2 text-[14px] text-white/70">At the end of the rollout, one alert is traced back to the sentence that caused it.</p>
          )}
        </section>

        {s.alerts.length > 0 && (
          <section className="bg-navy-2 p-5">
            <h2 className="text-[22px] text-white">Latest alerts</h2>
            <ul className="m-0 mt-3 grid gap-1 p-0 md:grid-cols-2">
              {s.alerts
                .slice(-10)
                .reverse()
                .map((a) => (
                  <li key={a.id} className="grid list-none grid-cols-[1fr_auto] gap-2 bg-white/5 px-3 py-2 text-[13px]">
                    <span className="code truncate text-white">{a.id}</span>
                    <span className="text-white/60">
                      {a.subject} · {a.metricValue.toFixed(2)}% · {a.mode}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="bg-navy-2 p-5">
          <h2 className="text-[22px] text-white">{bank.short} today</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <ul className="m-0 space-y-1 p-0">
              {bank.rules.map((r) => (
                <li key={r.rule_id} className="list-none bg-white/5 px-3 py-2 text-[14px] text-white">
                  <b>{r.rule_id}</b> {r.title}: fires when {r.when.op} {r.when.value}%{r.unless ? ", unless Board-approved" : ""}
                </li>
              ))}
            </ul>
            <ul className="m-0 space-y-1 p-0">
              {bank.policies.map((p) => (
                <li key={p.id} className="list-none bg-white/5 px-3 py-2 text-[14px] text-white/85">
                  <b className="text-white">§{p.section}</b> {p.text}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-[13px] text-white/60">
            Tier 1 capital ₹{bank.profile.tier1CapitalCr.toLocaleString("en-IN")} crore · all data synthetic
            {bank.circular.pdf && (
              <>
                {" · "}
                <a href={bank.circular.pdf} className="underline" target="_blank" rel="noreferrer">
                  Latest circular {bank.circular.ref} (PDF)
                </a>
              </>
            )}
          </p>
        </section>

        <p className="text-center text-[12.5px] text-white/50">
          A synthetic bank site for the NIYAM demonstration · Team Dragorithm · Virtusa Jatayu Season 6{bank.host ? ` · ${bank.host}` : ""}
        </p>
      </main>
    </div>
  );
}
