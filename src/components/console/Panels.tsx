"use client";

import { useMemo, useState } from "react";
import { diffLines } from "@/niyam/diff";
import type { AlertRecord, ApprovalView, DraftView, ReleaseBundle, ThreadView } from "@/niyam/events";
import { buildThread } from "@/niyam/thread";
import type { RunState } from "./state";

/* ---------- shared bits ---------- */

export function Section({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 bg-bg" aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 pb-4 pt-6">
        <h2 id={`${id}-h`} className="text-[22px] tracking-[-0.025em]">
          {title}
        </h2>
        {aside}
      </div>
      <div className="px-6 pb-8">{children}</div>
    </section>
  );
}

export function Chip({ tone = "muted", children }: { tone?: "ok" | "warn" | "bad" | "muted" | "accent" | "ink"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    muted: "bg-surface text-muted",
    accent: "bg-accent-soft text-accent",
    ink: "bg-ink text-white",
  }[tone];
  return <span className={`ui inline-block whitespace-nowrap px-2 py-0.5 text-[12px] font-semibold ${cls}`}>{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="ui bg-surface px-4 py-6 text-[14px] text-muted">{children}</p>;
}

function Highlight({ text, span }: { text: string; span?: string }) {
  if (!span) return <>{text}</>;
  const i = text.indexOf(span);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-accent-soft px-0.5 text-ink">{span}</mark>
      {text.slice(i + span.length)}
    </>
  );
}

const AGENT_LABEL: Record<string, string> = {
  conductor: "Conductor",
  reader: "Reader",
  extractor: "Extractor",
  mapper: "Mapper",
  author: "Author",
  validator: "Validator",
  release: "Release",
  human: "Humans",
};

/* ---------- timeline and A2A ---------- */

export function Timeline({ s }: { s: RunState }) {
  if (!s.steps.length) return <Empty>Press Run to start. Each agent step appears here with its measured duration.</Empty>;
  return (
    <ol className="m-0 p-0">
      {s.steps.map((st) => {
        const tone = st.status === "done" ? "ok" : st.status === "warn" ? "warn" : st.status === "error" ? "bad" : st.status === "blocked" ? "accent" : "muted";
        return (
          <li key={`${st.phase}-${st.id}`} className="rise list-none py-2.5">
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 ${st.status === "running" ? "pulse bg-accent" : tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-bad" : tone === "accent" ? "bg-accent" : "bg-surface-2"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="ui text-[14px] font-semibold text-ink">{st.title}</p>
                  {st.ms != null && <span className="num ui shrink-0 text-[12px] text-muted">{st.ms} ms</span>}
                </div>
                <p className="ui text-[12.5px] text-muted">
                  {AGENT_LABEL[st.agent] ?? st.agent}
                  {st.detail ? ` · ${st.detail}` : st.status === "running" ? " · working" : ""}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function A2AFeed({ s }: { s: RunState }) {
  const rows = s.a2a.filter((r) => r.state !== "TASK_STATE_SUBMITTED");
  if (!rows.length) return <Empty>A2A tasks between agents will appear here.</Empty>;
  return (
    <ul className="m-0 max-h-[340px] overflow-y-auto p-0" aria-label="A2A messages">
      {rows.map((r, i) => {
        const objection = r.skill === "resolve-objection";
        return (
          <li key={i} className={`ui list-none px-2 py-1.5 text-[12.5px] ${objection ? "bg-bad-soft" : ""}`}>
            <span className="font-semibold text-ink">{AGENT_LABEL[r.from] ?? r.from}</span>
            <span className="text-muted"> → {AGENT_LABEL[r.to] ?? r.to} · {r.skill}</span>
            <span className={`ml-1 ${r.state === "TASK_STATE_COMPLETED" ? "text-ok" : r.state === "TASK_STATE_REJECTED" || r.state === "TASK_STATE_FAILED" ? "text-bad" : "text-warn"}`}>
              {r.state.replace("TASK_STATE_", "").toLowerCase().replace("_", " ")}
            </span>
            <p className="m-0 truncate text-muted" title={r.summary}>
              {r.summary}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- circular and clauses ---------- */

export function ClausesPanel({ s }: { s: RunState }) {
  const [open, setOpen] = useState<string | null>("CL-017-4b");
  if (!s.clauses.length) return <Empty>The Reader segments the circular into numbered clauses and scopes each one.</Empty>;
  const spanFor = (id: string) => s.obligations.find((o) => o.clauseId === id)?.span;
  return (
    <div data-ui>
      <p className="mb-3 text-[13px] text-muted">
        Effective {s.effectiveFrom} · bank profile: Demo Urban Co-operative Bank (UCB) · {s.clauses.filter((c) => c.applicability === "applies").length} of {s.clauses.length} clauses apply
      </p>
      <ul className="m-0 p-0">
        {s.clauses.map((c) => {
          const tone = c.applicability === "applies" ? "ok" : c.applicability === "not_applicable" ? "warn" : "muted";
          const label = c.applicability === "applies" ? "Applies" : c.applicability === "not_applicable" ? "Not applicable" : "Informational";
          const isOpen = open === c.id;
          return (
            <li key={c.id} className="list-none">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : c.id)}
                className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors ${isOpen ? "bg-surface" : "bg-transparent hover:bg-surface"}`}
                aria-expanded={isOpen}
              >
                <span className="num w-10 shrink-0 font-semibold text-ink">{c.number}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{c.heading}</span>
                <Chip tone={tone}>{label}</Chip>
              </button>
              {isOpen && (
                <div className="rise bg-surface px-3 pb-3 pl-[64px]">
                  <p className="text-[15px] leading-[1.6] text-ink" style={{ fontFamily: "var(--font-text)" }}>
                    <Highlight text={c.text} span={spanFor(c.id)} />
                  </p>
                  <p className="mt-2 text-[12.5px] text-muted">{c.reason}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- obligations ---------- */

export function ObligationsPanel({ s }: { s: RunState }) {
  if (!s.obligations.length) return <Empty>Obligations appear here once the Extractor has verified their source spans.</Empty>;
  return (
    <div data-ui className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-3 py-2 font-normal">Obligation</th>
            <th className="px-3 py-2 font-normal">Kind</th>
            <th className="px-3 py-2 font-normal">Fires when</th>
            <th className="px-3 py-2 font-normal">Source span (exact substring)</th>
          </tr>
        </thead>
        <tbody>
          {s.obligations.map((o) => (
            <tr key={o.id} className="align-top odd:bg-surface">
              <td className="px-3 py-2 font-semibold text-ink">
                {o.id}
                <span className="block font-normal text-muted">para {o.clauseNumber}</span>
              </td>
              <td className="px-3 py-2 text-ink">
                {o.kind}
                <span className="block text-muted">{o.modality.replace("_", " ")}</span>
              </td>
              <td className="px-3 py-2 text-ink">
                {o.kind === "quantitative" ? (
                  <>
                    <span className="code">{o.metric}</span> <b>{o.operator}</b> {o.threshold}
                    <span className="block text-muted">“{o.comparatorPhrase}”</span>
                  </>
                ) : (
                  <span className="text-muted">{o.action.replace("_", " ")}</span>
                )}
              </td>
              <td className="px-3 py-2 text-ink">
                “{o.span}”
                <span className="block text-ok">
                  Verified: chars {o.spanStart} to {o.spanEnd} · {o.extractedBy}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.rejected.length > 0 && (
        <div className="mt-3 bg-bad-soft p-3 text-[13px] text-bad">
          {s.rejected.length} proposed obligation(s) rejected:{" "}
          {s.rejected.map((r) => `para ${r.clauseNumber} (${r.reason})`).join("; ")}
        </div>
      )}
    </div>
  );
}

/* ---------- mapping ---------- */

export function MappingPanel({ s }: { s: RunState }) {
  const m = s.mapping;
  if (!m) return <Empty>The Mapper walks the knowledge graph from each obligation to live rules and internal policies.</Empty>;
  const rows: { tone: "accent" | "warn" | "bad" | "muted"; label: string; title: string; body: string }[] = [
    ...m.modify.map((x) => ({ tone: "accent" as const, label: "Modify", title: `${x.ruleId} ← ${x.obligationId}`, body: x.change })),
    ...m.gaps.map((x) => ({ tone: "warn" as const, label: "Gap", title: `new ${x.proposedRuleId} ← ${x.obligationId}`, body: x.reason })),
    ...m.conflicts.map((x) => ({ tone: "bad" as const, label: "Conflict", title: x.policySection, body: `${x.detail} Resolution: ${x.resolution}` })),
    ...m.manualControls.map((x) => ({ tone: "muted" as const, label: "Manual control", title: x.obligationId, body: x.control })),
  ];
  return (
    <div data-ui className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[120px_1fr] gap-3 bg-surface px-3 py-2.5 text-[13.5px]">
          <div>
            <Chip tone={r.tone}>{r.label}</Chip>
          </div>
          <div>
            <p className="font-semibold text-ink">{r.title}</p>
            <p className="text-muted">{r.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- drafts, objections, tests ---------- */

function DiffBlock({ a, b, title }: { a: string; b: string; title: string }) {
  const lines = diffLines(a, b);
  return (
    <div className="bg-bg">
      <p className="ui px-3 py-1.5 text-[12px] text-muted">{title}</p>
      <pre className="m-0 whitespace-pre-wrap break-words py-1 text-[12.5px]">
        {lines.map((l, i) => (
          <div key={i} className={`px-3 ${l.sign === "-" ? "bg-bad-soft text-bad" : l.sign === "+" ? "bg-ok-soft text-ok" : "text-ink"}`}>
            <span className="mr-2 inline-block w-2 select-none opacity-70">{l.sign}</span>
            {l.text}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function DraftsPanel({ s, previousYaml }: { s: RunState; previousYaml: Record<string, string> }) {
  const [sql, setSql] = useState<string | null>(null);
  if (!s.drafts.length) return <Empty>Rule drafts are committed to draft/RBI-SYN-2026-017 and challenged by the Validator.</Empty>;
  return (
    <div className="space-y-6">
      {s.drafts.map((d) => {
        const history = s.draftHistory.filter((h) => h.ruleId === d.ruleId);
        const first = history[0];
        const objections = s.objections.filter((o) => o.objection.ruleId === d.ruleId);
        const tests = s.tests[d.ruleId] ?? [];
        const pass = tests.filter((t) => t.pass).length;
        return (
          <article key={d.ruleId} data-ui className="bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-ink">
                  {d.ruleId} v{d.version}
                </p>
                <Chip tone={d.kind === "new" ? "warn" : "accent"}>{d.kind === "new" ? "New rule" : "Amended"}</Chip>
                <span className="code text-[12px] text-muted">commit {d.commit}</span>
              </div>
              <div className="flex items-center gap-2">
                {tests.length > 0 && <Chip tone={pass === tests.length ? "ok" : "bad"}>{pass}/{tests.length} tests</Chip>}
                <button type="button" className="btn btn-quiet !bg-bg !px-3 !py-1.5 !text-[13px] hover:!bg-surface-2" onClick={() => setSql(sql === d.ruleId ? null : d.ruleId)}>
                  {sql === d.ruleId ? "Hide SQL" : "Compiled SQL"}
                </button>
              </div>
            </div>

            {objections.map(({ objection: o, round }) => (
              <div key={o.id} className="mx-4 mb-3 bg-bad-soft p-3 text-[13px]">
                <p className="font-semibold text-bad">
                  Objection {o.id} · {o.code} · round {round} · A2A task Validator → Author
                </p>
                <div className="mt-2 grid grid-cols-[76px_1fr] gap-x-3 gap-y-1 text-ink">
                  <span className="text-muted">Clause</span>
                  <span>
                    para {o.clause}: “{o.span}”
                  </span>
                  <span className="text-muted">Expected</span>
                  <span className="text-ok">{o.expected}</span>
                  <span className="text-muted">Found</span>
                  <span className="text-bad">{o.found}</span>
                  <span className="text-muted">Evidence</span>
                  <span>{o.evidence}</span>
                </div>
              </div>
            ))}

            <div className="grid gap-px bg-surface-2 md:grid-cols-2">
              {objections.length > 0 && first ? (
                <DiffBlock a={first.yaml} b={d.yaml} title={`Author's fix: round 1 (${first.commit}) to round ${d.round} (${d.commit})`} />
              ) : (
                <DiffBlock a={previousYaml[d.ruleId] ?? ""} b={d.yaml} title={previousYaml[d.ruleId] ? "Change against the live rule on main" : "New file"} />
              )}
              <div className="bg-bg">
                <p className="ui px-3 py-1.5 text-[12px] text-muted">{sql === d.ruleId ? "Compiled SQL (DuckDB-compatible)" : "Generated tests (from the obligation, not the draft)"}</p>
                {sql === d.ruleId ? (
                  <pre className="m-0 whitespace-pre-wrap break-words px-3 py-1 text-[12px] text-ink">{d.sql}</pre>
                ) : (
                  <table className="w-full border-collapse text-[12.5px]">
                    <tbody>
                      {tests.map((t) => (
                        <tr key={t.id} className={t.pass ? "" : "bg-bad-soft"}>
                          <td className="px-3 py-1 text-ink">{t.name}</td>
                          <td className="num px-2 py-1 text-muted">{t.given}</td>
                          <td className={`px-3 py-1 text-right font-semibold ${t.pass ? "text-ok" : "text-bad"}`}>
                            {t.fired ? "fires" : "quiet"} · {t.pass ? "pass" : "fail"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ---------- backtest ---------- */

export function BacktestPanel({ s }: { s: RunState }) {
  const bt = s.backtest;
  const [hover, setHover] = useState<number | null>(null);
  if (!bt) return <Empty>The Validator replays 90 days of the synthetic loan book through the old and new rules.</Empty>;
  const { series, impact } = bt;
  const max = Math.max(...series.new, ...series.old, 1) + 1;
  const tiles: [string, string, string][] = [
    ["Alerts over 90 days", `${impact.oldAlerts} → ${impact.newAlerts}`, `${impact.deltaPct >= 0 ? "+" : ""}${impact.deltaPct.toFixed(0)}% against the live rules`],
    ["Extra analyst time", `${impact.analystHours} h`, `at ${impact.minutesPerAlert} minutes per alert review (assumption)`],
    ["Newly flagged", `${impact.newlyFlaggedSubjects}`, "groups, borrowers or bank-level flags not flagged before"],
    ["Board items", `${impact.boardItems}`, "to place before the Board within 30 days (para 5)"],
  ];
  return (
    <div data-ui>
      <div className="grid grid-cols-2 gap-px bg-surface-2 lg:grid-cols-4">
        {tiles.map(([k, v, note]) => (
          <div key={k} className="bg-surface p-4">
            <p className="text-[12.5px] text-muted">{k}</p>
            <p className="num mt-1 text-[28px] font-bold tracking-[-0.03em] text-ink">{v}</p>
            <p className="text-[12px] text-muted">{note}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <span className="flex gap-4">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-ink" /> Live rules (v1)</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-accent" /> Amended and new rules</span>
          </span>
          <span className="num text-muted">
            {hover != null ? `${series.dates[hover]}: ${series.old[hover]} → ${series.new[hover]} alerts` : `${series.dates[0]} to ${series.dates[series.dates.length - 1]}`}
          </span>
        </div>
        <div
          className="mt-3 flex h-[200px] items-end gap-px"
          role="img"
          aria-label={`Daily alerts, ${impact.oldAlerts} under live rules and ${impact.newAlerts} under amended rules over ${impact.days} days`}
          onMouseLeave={() => setHover(null)}
        >
          {series.new.map((v, i) => (
            <div key={i} className={`relative h-full flex-1 ${hover === i ? "bg-surface-2" : ""}`} onMouseEnter={() => setHover(i)}>
              <div className="absolute inset-x-0 bottom-0 bg-accent" style={{ height: `${(v / max) * 100}%` }} />
              <div className="absolute inset-x-0 bottom-0 bg-ink" style={{ height: `${(series.old[i] / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <table className="mt-4 w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-3 py-1.5 font-normal">Rule</th>
            <th className="px-3 py-1.5 text-right font-normal">Old</th>
            <th className="px-3 py-1.5 text-right font-normal">New</th>
            <th className="px-3 py-1.5 text-right font-normal">Forecast / day</th>
            <th className="px-3 py-1.5 font-normal">Newly flagged</th>
          </tr>
        </thead>
        <tbody>
          {impact.rules.map((r) => (
            <tr key={r.ruleId} className="odd:bg-surface">
              <td className="px-3 py-1.5 font-semibold text-ink">
                {r.ruleId} <span className="font-normal text-muted">{r.title}</span>
              </td>
              <td className="num px-3 py-1.5 text-right">{r.oldAlerts}</td>
              <td className="num px-3 py-1.5 text-right">{r.newAlerts}</td>
              <td className="num px-3 py-1.5 text-right">
                {r.forecastMean.toFixed(1)} ± {r.forecastSd.toFixed(1)}
              </td>
              <td className="px-3 py-1.5 text-muted">{r.addedSubjects.slice(0, 6).join(", ") || "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- approvals ---------- */

export const APPROVER_LIST = [
  { id: "APR-CCO", name: "A. Menon", role: "Chief Compliance Officer" },
  { id: "APR-RISK", name: "R. Iyer", role: "Head of Risk and IT Change" },
];

export function ApprovalPanel({
  s,
  onSign,
  signing,
  tamper,
  setTamper,
  drift,
  setDrift,
  onRelease,
}: {
  s: RunState;
  onSign: (id: string) => void;
  signing: string | null;
  tamper: boolean;
  setTamper: (v: boolean) => void;
  drift: boolean;
  setDrift: (v: boolean) => void;
  onRelease: () => void;
}) {
  const bundle = s.bundle;
  if (!bundle) return <Empty>The pipeline stops here and waits for two people. Nothing reaches production without them.</Empty>;
  if (!bundle.drafts.length) return <Empty>This circular needs no rule changes for your bank, so there is nothing to sign. The mapping above lists any manual controls for Compliance.</Empty>;
  const signedBy = (id: string) => s.approvals.filter((a) => a.payload.approver_id === id);
  const both = APPROVER_LIST.every((a) => signedBy(a.id).length === bundle.drafts.length);
  const releasing = s.status === "releasing";
  return (
    <div data-ui className="space-y-4">
      <div className="bg-surface p-4 text-[13.5px]">
        <p className="font-semibold text-ink">
          Approval pack {bundle.runId}: {bundle.drafts.length} rules, {bundle.testsPassed}/{bundle.testsTotal} tests pass, {bundle.mapping.conflicts.length} policy conflict routed to Compliance
        </p>
        <p className="mt-1 text-muted">Each approver signs every rule file. A token is HMAC-SHA256 over the rule id, version, the SHA-256 of the exact YAML, the approver and their role.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {APPROVER_LIST.map((a) => {
          const toks = signedBy(a.id);
          const done = toks.length === bundle.drafts.length;
          return (
            <div key={a.id} className={`p-4 ${done ? "bg-ok-soft" : "bg-surface"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-ink">{a.name}</p>
                  <p className="text-[13px] text-muted">{a.role} · synthetic identity</p>
                </div>
                {done ? (
                  <Chip tone="ok">Signed</Chip>
                ) : (
                  <button type="button" className="btn !px-3 !py-2 !text-[14px]" onClick={() => onSign(a.id)} disabled={signing !== null || releasing}>
                    {signing === a.id ? "Signing…" : `Sign as ${a.name}`}
                  </button>
                )}
              </div>
              {toks.map((t) => (
                <p key={t.ruleId} className="code mt-2 truncate text-[11.5px] text-ink" title={t.token}>
                  {t.ruleId}: sha256 {t.payload.rule_sha256.slice(0, 12)}… · {t.token.slice(-22)}
                </p>
              ))}
            </div>
          );
        })}
      </div>
      <fieldset className="m-0 grid gap-2 border-0 p-0 text-[14px] md:grid-cols-2">
        <legend className="sr-only">Release options</legend>
        <label className="flex cursor-pointer items-start gap-3 bg-surface p-3">
          <input type="checkbox" checked={drift} onChange={(e) => setDrift(e.target.checked)} className="mt-1 h-4 w-4 accent-[#1d4ed8]" />
          <span>
            <b className="text-ink">Inject a data fault on rollout day 10</b>
            <span className="block text-[13px] text-muted">The loan feed loads twice. The Sentinel should catch it and roll back.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 bg-surface p-3">
          <input type="checkbox" checked={tamper} onChange={(e) => setTamper(e.target.checked)} className="mt-1 h-4 w-4 accent-[#b91c1c]" />
          <span>
            <b className="text-ink">Tamper test: edit a signed rule before release</b>
            <span className="block text-[13px] text-muted">Raises the first rule&apos;s limit by one in the file sent to Release. Expect a refusal.</span>
          </span>
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={onRelease} disabled={!both || releasing}>
          {releasing ? "Releasing…" : "Release to shadow, canary and live"}
        </button>
        {!both && <span className="text-[13px] text-muted">Both approvers must sign every rule first.</span>}
      </div>
    </div>
  );
}

/* ---------- rollout ---------- */

export function RolloutPanel({ s }: { s: RunState }) {
  if (!s.days.length && !s.verify) return <Empty>After release: three days in shadow, four in a 10% canary, then live, each day checked by the Sentinel.</Empty>;
  if (s.verify && !s.verify.ok) {
    return (
      <div data-ui className="bg-bad-soft p-4 text-[14px] text-bad">
        <p className="font-semibold">Release refused by the approvals and deploy-monitor servers.</p>
        <p className="mt-1">{s.verify.reason}</p>
        <p className="mt-2 text-ink">Nothing was promoted and no flag changed. Untick the tamper test and release again.</p>
      </div>
    );
  }
  const ruleIds = s.bundle?.drafts.map((d) => d.ruleId) ?? [];
  const maxObs = Math.max(4, ...s.days.flatMap((d) => Object.values(d.perRule).map((r) => Math.max(r.observed, r.band[1]))));
  return (
    <div data-ui className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[13px]">
        {s.promote && <Chip tone="ink">main ← draft · {s.promote.commit}</Chip>}
        {Object.values(s.rollout).map((r) => (
          <Chip key={r.ruleId} tone={r.mode === "rolled_back" ? "bad" : r.mode === "live" ? "ok" : r.mode === "canary" ? "accent" : "muted"}>
            {r.ruleId} v{r.version} · {r.mode.replace("_", " ")}
            {r.mode === "canary" ? ` ${r.canaryPct}%` : ""}
          </Chip>
        ))}
      </div>
      {ruleIds.map((rid) => (
        <div key={rid} className="bg-surface p-4">
          <p className="mb-2 text-[13px] font-semibold text-ink">
            {rid} <span className="font-normal text-muted">daily alerts against the backtest band</span>
          </p>
          <div className="flex h-[120px] items-end gap-1.5">
            {s.days.map((d) => {
              const r = d.perRule[rid];
              if (!r) return <div key={d.day} className="flex-1" />;
              const rolled = r.mode.startsWith("rolled_back");
              return (
                <div key={d.day} className="relative flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${r.observed} alerts${r.band[1] ? `, band ${r.band[0].toFixed(1)} to ${r.band[1].toFixed(1)}` : ""}`}>
                  {r.band[1] > 0 && !rolled && (
                    <div className="absolute inset-x-0 bg-ok-soft" style={{ bottom: `${(r.band[0] / maxObs) * 100}%`, height: `${((r.band[1] - r.band[0]) / maxObs) * 100}%` }} />
                  )}
                  <span className={`num relative text-center text-[10.5px] ${r.drift ? "font-bold text-bad" : "text-muted"}`}>{r.observed}</span>
                  <div
                    className={`relative ${r.drift ? "bg-bad" : rolled ? "bg-surface-2" : d.phase === "shadow" ? "bg-[#9aa8bd]" : d.phase === "canary" ? "bg-[#7f9fe8]" : "bg-accent"}`} /* taste-skill-ignore: "shadow" is the rollout phase */
                    style={{ height: `${Math.max(2, (r.observed / maxObs) * 100)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1.5 text-[10.5px] text-muted">
            {s.days.map((d) => (
              <span key={d.day} className="flex-1 text-center">
                {d.index}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-[#9aa8bd]" /> Shadow (log only)</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-[#7f9fe8]" /> Canary 10%</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-accent" /> Live</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-ok-soft" /> Forecast band, mean ± 3 sd</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-bad" /> Drift</span>
      </div>
      {s.rollbacks.map((r) => (
        <div key={r.ruleId} className="bg-bad-soft p-3 text-[13.5px] text-bad">
          <b>Auto-rollback {r.ruleId} to v{r.toVersion}</b> · revert commit <span className="code">{r.commit}</span>
          <p className="text-ink">{r.reason}. Flag off first, then the git revert; an incident goes to humans to diagnose the feed.</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- golden thread ---------- */

export function ThreadPanel({ s }: { s: RunState }) {
  const [query, setQuery] = useState("");
  const commits = useMemo(() => {
    const c: Record<string, string> = {};
    if (s.promote) for (const d of s.bundle?.drafts ?? []) c[d.ruleId] = s.promote.commit;
    return c;
  }, [s.promote, s.bundle]);
  const selected: ThreadView | undefined = useMemo(() => {
    if (!s.bundle) return undefined;
    const a = s.alerts.find((x) => x.id.toLowerCase() === query.trim().toLowerCase());
    if (a) return buildThread(a, s.bundle as ReleaseBundle, s.approvals as ApprovalView[], commits);
    return s.thread;
  }, [query, s.alerts, s.bundle, s.approvals, s.thread, commits]);

  if (!s.alerts.length || !selected) return <Empty>Once rules are live, enter any alert ID to walk from the alert back to the sentence that caused it.</Empty>;
  const t = selected;
  const steps: { k: string; v: React.ReactNode }[] = [
    { k: "Alert", v: <><b>{t.alert.id}</b> · {t.alert.subject} at {t.alert.metricValue.toFixed(2)}% on {t.alert.day} · {t.alert.mode}</> },
    { k: "Rule", v: <>{t.rule.ruleId} v{t.rule.version} “{t.rule.title}”{t.rule.commit ? <> · commit <span className="code">{t.rule.commit}</span></> : null}</> },
    {
      k: "Approvals",
      v: t.approvals.length ? (
        <>{t.approvals.map((a) => `${a.approver_name} (${a.role})`).join(" and ")} · signed sha256 {t.approvals[0].rule_sha256.slice(0, 16)}…</>
      ) : (
        <span className="text-muted">Version 1 predates NIYAM: approved under the old Master Direction</span>
      ),
    },
    ...(t.obligation ? [{ k: "Obligation", v: <>{t.obligation.id} · fire when <span className="code">{t.obligation.metric}</span> {t.obligation.operator} {t.obligation.threshold}</> }] : []),
    {
      k: "Clause",
      v: t.clause ? (
        <span style={{ fontFamily: "var(--font-text)" }} className="text-[15px]">
          para {t.clause.number}: <Highlight text={t.clause.text} span={t.clause.span} />
        </span>
      ) : null,
    },
    { k: "Circular", v: <>{t.circular.ref} · {t.circular.title}</> },
    ...(t.backtest ? [{ k: "Backtest", v: <>{t.backtest.oldAlerts} → {t.backtest.newAlerts} alerts over {t.backtest.days} days, reviewed before signing</> }] : []),
  ];
  const sample = s.alerts.filter((a) => a.mode !== "v1").slice(0, 8).concat(s.alerts.filter((a) => a.mode === "v1").slice(0, 2));
  return (
    <div data-ui className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="alert-id" className="text-[13px] text-muted">
          Alert ID
        </label>
        <input
          id="alert-id"
          list="alert-ids"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s.thread?.alert.id}
          className="code min-w-0 flex-1 bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:bg-surface-2"
        />
        <datalist id="alert-ids">
          {s.alerts.slice(0, 200).map((a) => (
            <option key={a.id} value={a.id} />
          ))}
        </datalist>
      </div>
      <ol className="m-0 bg-surface p-0 py-2">
        {steps.map((st, i) => (
          <li key={st.k} className="relative list-none py-2 pl-12 pr-4 text-[13.5px] text-ink">
            <span className={`absolute left-5 top-[13px] h-3 w-3 ${i === 0 ? "bg-accent" : "bg-ink"}`} />
            {i < steps.length - 1 && <span className="absolute left-[22.5px] top-[26px] h-[calc(100%-12px)] w-[2px] bg-surface-2" />}
            <span className="mr-2 font-semibold">{st.k}</span>
            {st.v}
          </li>
        ))}
      </ol>
      <div>
        <p className="mb-1 text-[12.5px] text-muted">
          {s.alerts.length} alerts in this rollout. Try one:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {sample.map((a: AlertRecord) => (
            <button key={a.id} type="button" onClick={() => setQuery(a.id)} className="code cursor-pointer bg-surface px-2 py-1 text-[11.5px] text-ink transition-colors hover:bg-accent-soft">
              {a.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- MCP log ---------- */

export function McpPanel({ s }: { s: RunState }) {
  const [all, setAll] = useState(false);
  if (!s.mcp.length) return <Empty>Every tool call any agent makes is recorded here, including the ones refused.</Empty>;
  const byServer = s.mcp.reduce<Record<string, number>>((acc, c) => ((acc[c.server] = (acc[c.server] ?? 0) + 1), acc), {});
  const denied = s.mcp.filter((c) => !c.allowed);
  const rows = all ? s.mcp : [...denied, ...s.mcp.filter((c) => c.allowed).slice(-12)];
  return (
    <div data-ui className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(byServer).map(([k, v]) => (
          <Chip key={k}>
            {k} · {v}
          </Chip>
        ))}
        <Chip tone="bad">{denied.length} refused</Chip>
      </div>
      {s.guardrails.length > 0 && (
        <div className="bg-bad-soft p-3 text-[13px]">
          <p className="font-semibold text-bad">Allowlist self-test</p>
          {s.guardrails.map((g, i) => (
            <p key={i} className="text-ink">
              {g.layer === "client" ? "Client" : "Server"}: {g.result}
            </p>
          ))}
        </div>
      )}
      <div className="max-h-[320px] overflow-y-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="sticky top-0 bg-bg">
            <tr className="text-left text-muted">
              <th className="px-3 py-1.5 font-normal">Agent</th>
              <th className="px-3 py-1.5 font-normal">Server</th>
              <th className="px-3 py-1.5 font-normal">Tool</th>
              <th className="px-3 py-1.5 text-right font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={i} className={c.allowed && !c.error ? "odd:bg-surface" : "bg-bad-soft"}>
                <td className="px-3 py-1">{AGENT_LABEL[c.agent] ?? c.agent}</td>
                <td className="px-3 py-1 text-muted">{c.server}</td>
                <td className="code px-3 py-1">{c.tool}</td>
                <td className={`num px-3 py-1 text-right ${c.allowed && !c.error ? "text-ok" : "text-bad"}`}>{c.allowed ? (c.error ? "error" : `${c.ms.toFixed(1)} ms`) : "refused"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-quiet !px-3 !py-1.5 !text-[13px]" onClick={() => setAll(!all)}>
        {all ? "Show refusals and the last 12" : `Show all ${s.mcp.length} calls`}
      </button>
    </div>
  );
}

export type { DraftView };
