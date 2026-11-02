"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { ENTITY_LABEL } from "@/niyam/data/bankProfile";
import type { BankDef } from "@/niyam/data/banks";
import { initialState, reducer, type RunState } from "@/components/console/state";
import { RolloutPanel, ThreadPanel } from "@/components/console/Panels";
import { CONSOLE_ORIGINS, isRelayMessage, type RelayMessage } from "./relay";

/**
 * A bank's own rule-engine operations page. It shows the bank's live rules, and when NIYAM
 * releases a change it shows shadow, canary and live rollout as it happens, the Sentinel, the
 * people who signed, and the Golden Thread. Events arrive from the console window that opened it;
 * the last release is kept in this browser so a reload still shows it.
 */

type Bank = Pick<BankDef, "key" | "short" | "kind" | "profile" | "rules" | "policies" | "brand" | "host" | "circular">;

const STORE = (k: string) => `niyam-bank-${k}-release`;

function trusted(origin: string) {
  return CONSOLE_ORIGINS.includes(origin) || origin === window.location.origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function apply(s: RunState, m: RelayMessage): RunState {
  if (m.kind === "init") return reducer({ ...initialState, status: "awaiting", bundle: m.bundle, approvals: m.approvals }, { type: "start_release" });
  if (m.kind === "event") return reducer(s, { type: "event", event: m.event });
  return s;
}

const STAGES = [
  { phase: "shadow", title: "Shadow", sub: "Days 1-3 · logs only, blocks nothing", pct: "0% of decisions" },
  { phase: "canary", title: "Canary", sub: "Days 4-7 · 10% of customers", pct: "10% of decisions" },
  { phase: "live", title: "Live", sub: "Day 8 onward · everyone", pct: "100% of decisions" },
] as const;

export function BankSite({ bank }: { bank: Bank }) {
  const [s, setS] = useState<RunState>(initialState);
  const [link, setLink] = useState<"waiting" | "connected" | "restored">("waiting");
  const log = useRef<RelayMessage[]>([]);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    // Restore the last release seen in this browser.
    try {
      const saved = JSON.parse(localStorage.getItem(STORE(bank.key)) ?? "null") as RelayMessage[] | null;
      if (Array.isArray(saved) && saved.length) {
        log.current = saved;
        setS(saved.reduce(apply, initialState));
        setLink("restored");
      }
    } catch {
      // Storage unavailable: start empty.
    }
    const onMessage = (e: MessageEvent) => {
      if (!trusted(e.origin) || !isRelayMessage(e.data) || e.data.kind === "ready") return;
      const m = e.data;
      if (m.kind === "init") {
        if (m.bank !== bank.key) return;
        log.current = [m];
      } else if (log.current[0]?.kind === "init") log.current.push(m);
      else return;
      setLink("connected");
      setS((prev) => apply(m.kind === "init" ? initialState : prev, m));
      try {
        localStorage.setItem(STORE(bank.key), JSON.stringify(log.current));
      } catch {
        // Quota or private mode: the live view still works.
      }
      force();
    };
    window.addEventListener("message", onMessage);
    // Tell the console that opened this page that it can send (or replay) the release.
    window.opener?.postMessage({ niyam: 1, kind: "ready", bank: bank.key }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [bank.key]);

  const last = s.days[s.days.length - 1];
  const phase = last?.phase;
  const released = !!s.bundle;
  const refused = s.verify && !s.verify.ok;
  const rolled = s.rollbacks.length > 0;
  const done = s.status === "released";
  const headline = !released
    ? "Live rules unchanged. Waiting for a NIYAM release."
    : refused
      ? "Release refused: approvals did not verify. Nothing changed."
      : !last
        ? "Release received. Verifying both signatures…"
        : `Day ${last.index} · ${phase === "shadow" ? "Shadow mode: the new rules log what they would do" : phase === "canary" ? "Canary: the new rules decide for 10% of customers" : "Live: the new rules decide for everyone"}${done ? " · rollout complete" : ""}`;
  const approvals = Object.values(
    Object.fromEntries((s.approvals ?? []).map((a) => [a.payload.approver_id, a.payload])),
  );
  const stageIdx = phase ? STAGES.findIndex((x) => x.phase === phase) : -1;

  return (
    <div className="min-h-svh bg-surface">
      <header style={{ background: bank.brand }} className="text-white">
        <div className="wrap flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="ui text-[13px] uppercase tracking-[0.08em] text-white/75">{bank.kind} · {ENTITY_LABEL[bank.profile.entityType]}</p>
            <h1 className="mt-1 text-[clamp(26px,3vw,40px)] text-white">{bank.short} · Rule engine operations</h1>
          </div>
          <div className="ui flex flex-wrap items-center gap-2 text-[13px]">
            <span className="bg-white/15 px-2.5 py-1">Synthetic bank</span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 ${link === "connected" ? "bg-white text-ink" : "bg-white/15"}`}>
              <i className={`inline-block h-2 w-2 ${link === "connected" ? (done ? "bg-ok" : "pulse bg-ok") : "bg-white/60"}`} />
              {link === "connected" ? "Live link to NIYAM" : link === "restored" ? "Last release (saved in this browser)" : "Waiting for NIYAM"}
            </span>
          </div>
        </div>
      </header>

      <main data-ui className="wrap space-y-5 py-6">
        <section aria-live="polite" className={`p-5 ${refused || rolled ? "bg-bad-soft" : done ? "bg-ok-soft" : "bg-bg"}`}>
          <p className={`text-[clamp(18px,1.8vw,24px)] font-semibold ${refused ? "text-bad" : "text-ink"}`}>{headline}</p>
          {released && s.bundle && (
            <p className="ui mt-1 text-[14px] text-muted">
              Release {s.bundle.runId} from circular {s.bundle.circularRef} · {s.bundle.drafts.length} rule change{s.bundle.drafts.length > 1 ? "s" : ""}
              {s.promote ? ` · merged as commit ${s.promote.commit}` : ""}
            </p>
          )}
          {rolled && (
            <p className="mt-2 text-[15px] text-bad">
              The Sentinel rolled back {s.rollbacks.map((r) => `${r.ruleId} to v${r.toVersion}`).join(", ")} automatically. Turning it back on is a human decision.
            </p>
          )}
        </section>

        {/* Stage tracker */}
        <section aria-label="Rollout stages" className="grid gap-2 md:grid-cols-3">
          {STAGES.map((st, i) => {
            const now = i === stageIdx && !done;
            const past = i < stageIdx || (done && i <= stageIdx);
            return (
              <div key={st.phase} className={`p-4 ${now ? "bg-ink text-white" : past ? "bg-ok-soft" : "bg-bg"}`}>
                <p className={`ui text-[12px] font-semibold uppercase tracking-[0.06em] ${now ? "text-white/70" : "text-muted"}`}>Stage {i + 1}</p>
                <p className="mt-1 flex items-center gap-2 text-[20px] font-semibold">
                  {now && <i className="pulse inline-block h-2.5 w-2.5 bg-white" />}
                  {st.title}
                </p>
                <p className={`text-[13.5px] ${now ? "text-white/80" : "text-muted"}`}>{st.sub}</p>
                <p className={`ui mt-2 text-[13px] font-semibold ${now ? "text-white" : "text-ink"}`}>{st.pct}</p>
              </div>
            );
          })}
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className="bg-bg p-5">
            <h2 className="text-[20px]">Rules in production</h2>
            <table className="ui mt-3 w-full border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] text-muted">
                  <th className="py-1.5 font-normal">Rule</th>
                  <th className="py-1.5 font-normal">Condition</th>
                  <th className="py-1.5 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {bank.rules.map((r) => {
                  const roll = s.rollout[r.rule_id];
                  const v2 = s.bundle?.drafts.find((d) => d.ruleId === r.rule_id);
                  return (
                    <tr key={r.rule_id} className="border-t border-surface-2 align-top">
                      <td className="py-2 font-semibold text-ink">{r.rule_id}</td>
                      <td className="py-2 text-ink">
                        v1: {r.when.op} {r.when.value}%
                        {v2 && <span className="block text-accent">v2: {v2.yaml.match(/op: "([^"]+)"/)?.[1]} {v2.yaml.match(/value: ([\d.]+)/)?.[1]}%</span>}
                      </td>
                      <td className="py-2">
                        {roll ? <Mode m={roll.mode} pct={roll.canaryPct} /> : <Mode m="live-v1" />}
                      </td>
                    </tr>
                  );
                })}
                {s.bundle?.drafts
                  .filter((d) => !bank.rules.some((r) => r.rule_id === d.ruleId))
                  .map((d) => {
                    const roll = s.rollout[d.ruleId];
                    return (
                      <tr key={d.ruleId} className="border-t border-surface-2 align-top">
                        <td className="py-2 font-semibold text-ink">
                          {d.ruleId} <span className="font-normal text-muted">(new)</span>
                        </td>
                        <td className="py-2 text-accent">
                          new: {d.yaml.match(/op: "([^"]+)"/)?.[1]} {d.yaml.match(/value: ([\d.]+)/)?.[1]}%
                        </td>
                        <td className="py-2">{roll ? <Mode m={roll.mode} pct={roll.canaryPct} /> : <Mode m="pending" />}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <p className="ui mt-3 text-[12.5px] text-muted">
              Tier 1 capital ₹{bank.profile.tier1CapitalCr.toLocaleString("en-IN")} crore · {bank.profile.state} · data is synthetic
            </p>
          </section>

          <section className="bg-bg p-5">
            <h2 className="text-[20px]">Signed off by</h2>
            {approvals.length ? (
              <ul className="m-0 mt-3 space-y-2 p-0">
                {approvals.map((p) => (
                  <li key={p.approver_id} className="list-none bg-surface p-3">
                    <p className="ui text-[12px] font-semibold uppercase tracking-[0.06em] text-ok">{p.duty ?? "Approver"}</p>
                    <p className="text-[15px] font-semibold text-ink">{p.approver_name}</p>
                    <p className="ui text-[12.5px] text-muted">
                      {p.role}
                      {p.employee_id ? ` · ${p.employee_id}` : ""} · {new Date(p.issued_at).toLocaleString()}
                    </p>
                    {p.reason && <p className="mt-1 text-[13.5px] text-ink">“{p.reason}”</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ui mt-3 text-[14px] text-muted">No release yet. Two people must sign in the NIYAM console before anything reaches this bank.</p>
            )}
          </section>
        </div>

        <section className="bg-bg p-5">
          <h2 className="text-[20px]">Daily alerts and the Sentinel</h2>
          <p className="ui mb-3 mt-1 text-[13.5px] text-muted">Each day the Sentinel compares live alerts with the backtest forecast band. Outside the band, it switches the rule off and reverts it.</p>
          <RolloutPanel s={s} />
        </section>

        {s.alerts.length > 0 && (
          <section className="bg-bg p-5">
            <h2 className="text-[20px]">Latest alerts</h2>
            <ul className="m-0 mt-3 grid gap-1 p-0 md:grid-cols-2">
              {s.alerts.slice(-12).reverse().map((a) => (
                <li key={a.id} className="ui grid list-none grid-cols-[1fr_auto] gap-2 bg-surface px-3 py-2 text-[13px]">
                  <span className="code truncate text-ink">{a.id}</span>
                  <span className="text-muted">
                    {a.subject} · {a.metricValue.toFixed(2)}% · {a.mode}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-bg p-5">
          <h2 className="text-[20px]">Golden Thread: why did an alert fire?</h2>
          <div className="mt-3">
            <ThreadPanel s={s} />
          </div>
        </section>

        <section className="bg-bg p-5">
          <h2 className="text-[20px]">Internal policy</h2>
          <ul className="m-0 mt-3 space-y-1 p-0">
            {bank.policies.map((p) => (
              <li key={p.id} className="list-none bg-surface px-3 py-2 text-[14px] text-ink">
                <b>{p.policy.replace(/\s*\(SYNTHETIC\)\s*$/, "")} §{p.section}</b> {p.text}
              </li>
            ))}
          </ul>
          <p className="ui mt-3 text-[13px] text-muted">
            Latest circular received:{" "}
            <a href={bank.circular.pdf} className="link text-accent" target="_blank" rel="noreferrer">
              {bank.circular.ref} (PDF)
            </a>
          </p>
        </section>

        <p className="ui text-center text-[12.5px] text-muted">
          A synthetic bank site for the NIYAM demonstration · Team Dragorithm · Virtusa Jatayu Season 6 · {bank.host}
        </p>
      </main>
    </div>
  );
}

function Mode({ m, pct }: { m: string; pct?: number }) {
  const map: Record<string, [string, string]> = {
    "live-v1": ["Live (v1)", "bg-ok-soft text-ok"],
    pending: ["Awaiting rollout", "bg-surface text-muted"],
    off: ["Off", "bg-surface text-muted"],
    shadow: ["Shadow · logging only", "bg-surface-2 text-ink"],
    canary: [`Canary · ${pct ?? 10}%`, "bg-accent-soft text-accent"],
    live: ["Live (v2)", "bg-ok-soft text-ok"],
    rolled_back: ["Rolled back to v1", "bg-bad-soft text-bad"],
  };
  const [label, cls] = map[m] ?? [m, "bg-surface text-ink"];
  return <span className={`ui inline-block px-2 py-0.5 text-[12.5px] font-semibold ${cls}`}>{label}</span>;
}
