"use client";

import { useEffect, useRef, useState } from "react";
import { SNAPSHOT } from "@/content/runSnapshot";
import { Synthetic } from "./Fragments";

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div data-ui className="bg-bg text-ink">
      <div className="flex items-center justify-between gap-3 border-b border-surface-2 px-4 py-2.5 text-[12.5px] text-muted">
        <span className="truncate">{title}</span>
        {right ?? <Synthetic />}
      </div>
      {children}
    </div>
  );
}

function CardPanel() {
  const json = `{
  "name": "niyam-validator",
  "supportedInterfaces": [{
    "url": "…/a2a/validator",
    "protocolBinding": "JSONRPC",
    "protocolVersion": "1.0"
  }],
  "skills": [
    { "id": "validate-draft", "tags": ["validation", "boundary-tests", "objection"] },
    { "id": "backtest-impact", "tags": ["backtest", "impact", "sandbox"] }
  ],
  "capabilities": { "extensions": [{
    "uri": "…/ext/mcp-allowlist/v1",
    "params": { "tools": ["kg_read_obligations", "dsl_validate",
      "dsl_compile", "bt_run_tests", "bt_run_backtest", "git_diff"] }
  }]}
}`;
  return (
    <Panel title="GET /a2a/validator/.well-known/agent-card.json" right={<span className="text-ok">200</span>}>
      <pre className="m-0 overflow-hidden p-4 text-[12px] leading-[1.5]">{json}</pre>
    </Panel>
  );
}

function DenyPanel() {
  const rows: [string, string, string, string][] = [
    ["reader", "kg_write_clauses", "regulatory-kg", "allowed"],
    ["extractor", "sm_resolve_metric", "semantic-model", "allowed"],
    ["extractor", "deploy_set_mode", "client", "denied"],
    ["extractor", "deploy_set_mode", "deploy-monitor", "denied"],
    ["author", "git_commit_draft", "git-draft", "allowed"],
    ["author", "commit to main", "git-draft", "denied"],
    ["release", "deploy_set_mode", "deploy-monitor", "allowed"],
  ];
  return (
    <Panel title="MCP call log · allowlists checked twice">
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {rows.map(([a, t, s, r], i) => (
            <tr key={i} className={r === "denied" ? "bg-bad-soft" : ""}>
              <td className="px-4 py-1.5 text-muted">{a}</td>
              <td className="px-2 py-1.5">{t}</td>
              <td className="px-2 py-1.5 text-muted">{s}</td>
              <td className={`px-4 py-1.5 text-right font-semibold ${r === "denied" ? "text-bad" : "text-ok"}`}>{r}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function BacktestPanel() {
  const { old, new: nw } = SNAPSHOT.backtest;
  const max = 11;
  return (
    <Panel title="Validator · 90-day backtest, alerts per day">
      <div className="p-4">
        <div className="flex h-[150px] items-end gap-px" role="img" aria-label="Daily alerts: old rules about 1 a day, amended rules about 6 to 10 a day">
          {nw.map((v, i) => (
            <div key={i} className="relative h-full flex-1">
              <div className="absolute inset-x-0 bottom-0 bg-accent" style={{ height: `${(v / max) * 100}%` }} />
              <div className="absolute inset-x-0 bottom-0 bg-ink" style={{ height: `${(old[i] / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
          <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-ink" /> Live rules v1: {SNAPSHOT.backtest.oldTotal}</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-accent" /> Amended rules: {SNAPSHOT.backtest.newTotal}</span>
          <span className="text-muted">1 Jul to 28 Sep 2026</span>
        </div>
      </div>
    </Panel>
  );
}

function SqlPanel() {
  return (
    <Panel title="DSL compiler · SYN-EXP-012 v2 to SQL" right={<span className="text-muted">DuckDB-compatible</span>}>
      <pre className="m-0 overflow-hidden p-4 text-[12px] leading-[1.55]">{SNAPSHOT.sql}</pre>
    </Panel>
  );
}

function GitPanel() {
  return (
    <Panel title="git log draft/RBI-SYN-2026-017">
      <ul className="m-0 p-0 py-1">
        {SNAPSHOT.gitLog.map(([sha, msg, who]) => (
          <li key={sha} className="list-none px-4 py-1.5 text-[13px]">
            <span className="code mr-2 text-accent">{sha}</span>
            <span>{msg}</span>
            <span className="block text-[12px] text-muted">{who}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ThreadPanel() {
  const chain: [string, string][] = [
    ["Alert", "ALR-EXP012V2-261006-001 · GRP-001 at 17.66% · 6 Oct 2026, live"],
    ["Rule", "SYN-EXP-012 v2 “Group exposure report”"],
    ["Approvals", "A. Menon (CCO) and R. Iyer (Risk), tokens over sha256 e0a3907c…"],
    ["Obligation", "OBL-017-4b · fire when group exposure > 12"],
    ["Clause", "para 4(b): “aggregate exposure exceeding 12 per cent of Tier 1 capital”"],
    ["Circular", "RBI-SYN-2026-017, issued 15 Sep 2026"],
  ];
  return (
    <Panel title="Golden Thread · one click for an inspector">
      <ol className="m-0 p-0 py-2">
        {chain.map(([k, v], i) => (
          <li key={k} className="relative list-none py-1.5 pl-10 pr-4 text-[13px]">
            <span className={`absolute left-4 top-[11px] h-2.5 w-2.5 ${i === 0 ? "bg-accent" : "bg-ink"}`} />
            {i < chain.length - 1 && <span className="absolute left-[20px] top-[22px] h-[calc(100%-10px)] w-[2px] bg-surface-2" />}
            <span className="font-semibold">{k}</span> <span className="text-muted">{v}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const PANELS = [
  { name: "Agent Cards", lines: "Each agent publishes an A2A v1.0 card. The Conductor finds workers by skill tags, never by hard-coded calls.", node: <CardPanel />, w: 440 },
  { name: "Least privilege", lines: "Tools sit behind MCP servers. The Extractor asking for the deploy API is refused by its client and again by the server.", node: <DenyPanel />, w: 420 },
  { name: "Drafts in git", lines: "Every draft and every fix is a commit on a draft branch with a real SHA. Main only moves after two signatures.", node: <GitPanel />, w: 440 },
  { name: "Rules compile", lines: "The LLM never writes executable code. Typed YAML compiles to SQL, with percentages rounded so 12.00% compares as 12.", node: <SqlPanel />, w: 420 },
  { name: "Impact first", lines: "Ninety days of the synthetic loan book, replayed through old and new rules before anyone is asked to sign.", node: <BacktestPanel />, w: 460 },
  { name: "Golden Thread", lines: "Any alert opens its rule version, its two approvers, its obligation and the exact words of the clause.", node: <ThreadPanel />, w: 440 },
];

export function Showcase() {
  const row = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = el.getBoundingClientRect().left + el.clientWidth / 2;
        let best = 0;
        let bestD = Infinity;
        el.querySelectorAll<HTMLElement>("[data-panel]").forEach((p) => {
          const r = p.getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - mid);
          if (d < bestD) {
            bestD = d;
            best = Number(p.dataset.panel);
          }
        });
        setActive(best);
      });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, []);

  const go = (d: number) => {
    const el = row.current;
    const next = Math.max(0, Math.min(PANELS.length - 1, active + d));
    el?.querySelector<HTMLElement>(`[data-panel="${next}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <section className="bg-navy py-24 text-on-navy lg:py-28" aria-labelledby="proof-title">
      <div className="wrap">
        <h2 id="proof-title" className="max-w-[18ch] text-[clamp(32px,3.6vw,56px)] text-on-navy">
          The parts, working
        </h2>
        <p className="mt-5 max-w-[56ch] text-[18px] text-on-navy-muted">
          Six pieces of the running system, cropped at true size. Drag the row or use the arrows.
        </p>
      </div>

      <div
        ref={row}
        className="scrollbar-none mt-14 flex snap-x snap-mandatory items-center gap-[8vw] overflow-x-auto px-[calc(50vw-230px)] py-4 max-lg:px-[7vw]"
        tabIndex={0}
        aria-label="Interface panels"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {PANELS.map((p, i) => (
          <article
            key={p.name}
            data-panel={i}
            className="shrink-0 snap-center transition-[opacity,transform] duration-500"
            style={{ width: `min(${p.w}px, 86vw)`, opacity: i === active ? 1 : 0.3, transform: i === active ? "none" : "scale(0.96)" }}
            aria-current={i === active}
          >
            {p.node}
          </article>
        ))}
      </div>

      <div className="wrap mt-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div aria-live="polite" key={active} className="rise">
          <p className="ui text-[24px] font-semibold text-on-navy">{PANELS[active].name}</p>
          <p className="mt-2 max-w-[52ch] text-[17px] text-on-navy-muted">{PANELS[active].lines}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn bg-navy-2 hover:bg-[#1b3a66]" onClick={() => go(-1)} disabled={active === 0} aria-label="Previous panel">
            Previous
          </button>
          <button type="button" className="btn" onClick={() => go(1)} disabled={active === PANELS.length - 1} aria-label="Next panel">
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
