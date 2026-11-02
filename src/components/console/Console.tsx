"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { bankByKey, bankSiteUrl } from "@/niyam/data/banks";
import { toYaml } from "@/niyam/dsl/schema";
import type { ApprovalView, ReleaseBundle } from "@/niyam/events";
import { Wordmark } from "@/components/Logo";
import { BankRelay } from "@/components/bank/relay";
import {
  A2AFeed,
  BacktestPanel,
  Chip,
  ClausesPanel,
  DraftsPanel,
  MappingPanel,
  McpPanel,
  ObligationsPanel,
  RolloutPanel,
  Section,
  ThreadPanel,
  Timeline,
} from "./Panels";
import { AgentMesh } from "./AgentMesh";
import { AgentOutputs } from "./AgentOutputs";
import { ApprovalForms, type ReviewInput } from "./Approval";
import { LlmPanel } from "./LlmPanel";
import { Narrator, narrate } from "./Narrator";
import { DEFAULT_SETUP, RunSetup, type SetupValue } from "./RunSetup";
import { AuditPack } from "./AuditPack";
import { GraphPanel } from "./GraphPanel";
import { ImpactNarrative } from "./ImpactNarrative";
import { WhatIf } from "./WhatIf";
import { PolicyRedline } from "./PolicyRedline";
import { initialState, reducer, streamEvents } from "./state";

interface Status {
  llm: { available: boolean; model: string };
  engine: string;
  approvalSecret: string;
}

const NAV = [
  ["setup", "Setup"],
  ["mesh", "Agent mesh"],
  ["claude", "Claude live"],
  ["circular", "Circular"],
  ["obligations", "Obligations"],
  ["mapping", "Mapping"],
  ["redline", "Policy redline"],
  ["drafts", "Drafts and tests"],
  ["backtest", "Backtest"],
  ["whatif", "What if"],
  ["approval", "Approval"],
  ["rollout", "Rollout"],
  ["thread", "Golden Thread"],
  ["audit", "Audit pack"],
  ["graph", "Knowledge graph"],
  ["tools", "MCP tools"],
] as const;

export function Console() {
  const [s, dispatch] = useReducer(reducer, initialState);
  const [status, setStatus] = useState<Status | null>(null);
  const [path, setPath] = useState<"rule-based" | "llm">("rule-based");
  const [signing, setSigning] = useState<string | null>(null);
  const [tamper, setTamper] = useState(false);
  const [drift, setDrift] = useState(true);
  const [setup, setSetup] = useState<SetupValue>(DEFAULT_SETUP);
  const [follow, setFollow] = useState(true);
  const abort = useRef<AbortController | null>(null);
  const header = useRef<HTMLDivElement>(null);
  const relay = useRef<BankRelay | null>(null);
  const [origin, setOrigin] = useState<string | undefined>();
  const bank = bankByKey(s.bundle?.bankKey ?? setup.bank);
  const site = bankSiteUrl(bank, origin);

  useEffect(() => {
    setOrigin(window.location.origin);
    relay.current = new BankRelay();
    return () => relay.current?.close();
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const previousYaml = useMemo(() => Object.fromEntries(bank.rules.map((r) => [r.rule_id, toYaml(r)])), [bank]);

  // Back: return to wherever the visitor came from on this site, or to the landing page.
  function back() {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) window.history.back();
    else window.location.href = "/";
  }

  // Scroll a section to just below the sticky header, whatever its current height.
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = (header.current?.offsetHeight ?? 0) + 12;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  };

  async function run() {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    dispatch({ type: "start" });
    const circular = { ref: setup.ref, text: setup.text, synthetic: true, ...(setup.source === "bank-pdf" ? { title: bankByKey(setup.bank).circular.title } : {}) };
    try {
      await streamEvents("/api/run", { path, bank: setup.bank, circular }, (event) => dispatch({ type: "event", event }), ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") dispatch({ type: "error", message: (e as Error).message });
    }
  }

  async function sign(approverId: string, review: ReviewInput) {
    if (!s.bundle) return;
    setSigning(approverId);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId, bundle: s.bundle, review }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      dispatch({ type: "approve", approvals: data.tokens as ApprovalView[] });
    } catch (e) {
      dispatch({ type: "error", message: (e as Error).message });
    } finally {
      setSigning(null);
    }
  }

  async function release() {
    if (!s.bundle) return;
    const tokens: Record<string, string[]> = {};
    for (const a of s.approvals) (tokens[a.ruleId] ??= []).push(a.token);
    // Tamper test: raise the first signed rule's limit by one after both approvals.
    const bundle: ReleaseBundle = tamper
      ? { ...s.bundle, drafts: s.bundle.drafts.map((d, i) => (i === 0 ? { ...d, yaml: d.yaml.replace(/value: ([\d.]+)/, (_, v) => `value: ${Number(v) + 1}`) } : d)) }
      : s.bundle;
    dispatch({ type: "start_release" });
    // Open the bank's own rule-engine site and stream the rollout to it as it happens.
    const r = relay.current;
    r?.open(site, bank.key);
    r?.send({ niyam: 1, kind: "init", bank: bank.key, bundle: s.bundle, approvals: s.approvals, path: s.meta?.path });
    const ac = new AbortController();
    abort.current = ac;
    try {
      await streamEvents(
        "/api/release",
        { bundle, tokens, injectDrift: drift },
        (event) => {
          dispatch({ type: "event", event });
          r?.send({ niyam: 1, kind: "event", event });
        },
        ac.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") dispatch({ type: "error", message: (e as Error).message });
    }
  }

  // Follow along: bring the section the narrator is talking about into view as the run moves.
  const narration = narrate(s);
  useEffect(() => {
    if (!follow || s.status === "idle") return;
    // Scroll once quickly, then re-settle while panels above the target (the What-if chart
    // fetches its own data) finish laying out and push it down.
    const timers = [250, 1100, 2400, 4000].map((ms) => setTimeout(() => scrollTo(narration.section), ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narration.section, follow]);

  const running = s.status === "running" || s.status === "releasing";
  const llmOk = status?.llm.available ?? false;
  const pathRan = s.meta?.path;

  return (
    <div className="min-h-svh bg-surface">
      {/* One pinned bar: back, the bank and its live site, the mode and Run. The narrator joins it during a run. */}
      <div ref={header} className="sticky top-0 z-30">
        <div className="bg-bg shadow-[0_1px_0_rgba(11,31,58,0.08)]">
          <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={back} aria-label="Back" title="Back" className="ui flex h-9 cursor-pointer items-center gap-1.5 bg-surface px-3 text-[14px] text-ink transition-colors hover:bg-surface-2">
                <span aria-hidden="true">←</span> Back
              </button>
              <Link href="/" className="no-underline" aria-label="NIYAM home">
                <Wordmark />
              </Link>
              <span className="hidden h-6 w-px bg-surface-2 md:block" aria-hidden="true" />
              <div className="hidden min-w-0 md:block">
                <p className="ui truncate text-[14px] font-semibold text-ink">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 align-middle" style={{ background: bank.brand }} aria-hidden="true" />
                  {bank.short} · {bank.kind}
                </p>
                <a href={site} target={`niyam-bank-${bank.key}`} rel="noopener" className="ui link block truncate text-[12.5px] text-accent">
                  {site.replace(/^https?:\/\//, "")} ↗
                </a>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="ui flex bg-surface p-1 text-[13px]" role="radiogroup" aria-label="Execution path">
                <button
                  type="button"
                  role="radio"
                  aria-checked={path === "rule-based"}
                  onClick={() => setPath("rule-based")}
                  className={`cursor-pointer px-3 py-1.5 transition-colors ${path === "rule-based" ? "bg-ink text-white" : "bg-transparent text-ink hover:bg-bg"}`}
                >
                  Rule-based
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={path === "llm"}
                  onClick={() => llmOk && setPath("llm")}
                  disabled={!llmOk}
                  title={llmOk ? `Extractor and Author use ${status?.llm.model}` : "Set ANTHROPIC_API_KEY on the deployment to enable"}
                  className={`px-3 py-1.5 transition-colors ${path === "llm" ? "bg-ink text-white" : llmOk ? "cursor-pointer bg-transparent text-ink hover:bg-bg" : "cursor-not-allowed bg-transparent text-soft"}`}
                >
                  {llmOk ? "Claude live" : "Claude (no key)"}
                </button>
              </div>
              <button type="button" className="btn" onClick={run} disabled={running || !setup.text.trim()}>
                {s.status === "running" ? "Running…" : s.status === "idle" ? "Run the pipeline" : "Run again"}
              </button>
            </div>
          </div>
        </div>
        {s.status !== "idle" && <Narrator s={s} follow={follow} setFollow={setFollow} onJump={scrollTo} />}
      </div>

      <div className="bg-surface">
        <div className="wrap pt-5">
          <h1 className="text-[clamp(24px,2.4vw,32px)] tracking-[-0.03em]">Pipeline console</h1>
          <p className="ui mt-1 text-[14px] text-muted">
            {setup.ref} · {bank.profile.name.replace(/\s*\(SYNTHETIC\)\s*$/i, "")} · synthetic bank data
          </p>
        </div>
        <nav className="wrap scrollbar-none mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Console sections">
          {NAV.map(([id, label]) => (
            <button key={id} type="button" onClick={() => scrollTo(id)} className="ui shrink-0 cursor-pointer bg-transparent px-2.5 py-1 text-[13px] text-muted transition-colors hover:bg-bg hover:text-ink">
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="wrap grid gap-5 pb-24 pt-4 lg:grid-cols-[272px_1fr]">
        {/* Left: run status, kept narrow so the run itself has the room */}
        <aside className={`min-w-0 space-y-3 lg:sticky lg:self-start lg:overflow-y-auto ${s.status === "idle" ? "lg:top-[84px] lg:max-h-[calc(100svh-100px)]" : "lg:top-[168px] lg:max-h-[calc(100svh-184px)]"}`}>
          <div className="bg-bg p-4">
            <p className="ui mb-1 text-[14px] font-semibold text-ink">What each agent produced</p>
            <AgentOutputs s={s} onJump={scrollTo} />
          </div>
          <div className="bg-bg p-4">
            <div className="ui flex flex-wrap gap-1.5">
              <Chip tone={s.status === "released" ? "ok" : s.status === "refused" || s.status === "error" ? "bad" : s.status === "awaiting" ? "accent" : running ? "warn" : "muted"}>
                {
                  {
                    idle: "Ready",
                    running: "Running",
                    awaiting: "Awaiting two signatures",
                    releasing: "Releasing",
                    released: "Released",
                    refused: "Release refused",
                    error: "Error",
                  }[s.status]
                }
              </Chip>
              {pathRan && <Chip tone={pathRan === "llm" ? "accent" : "muted"}>Path: {pathRan === "llm" ? `Claude (${s.meta?.llmModel})` : "rule-based"}</Chip>}
              {s.meta && <Chip>{s.meta.runId}</Chip>}
            </div>
            {s.meta?.note && <p className="ui mt-2 text-[12.5px] text-warn">{s.meta.note}</p>}
            {s.logs.map((l, i) => (
              <p key={i} className={`ui mt-2 text-[12.5px] ${l.level === "warn" ? "text-warn" : "text-muted"}`}>
                {l.text}
              </p>
            ))}
            {s.error && <p className="ui mt-2 bg-bad-soft p-2 text-[13px] text-bad">{s.error}</p>}
            <details className="mt-2" open={running}>
              <summary className="ui cursor-pointer text-[13px] font-semibold text-ink">Agent steps, with measured time</summary>
              <div className="mt-1">
                <Timeline s={s} />
              </div>
            </details>
            {s.testsTotal && (
              <p className="ui mt-2 bg-ok-soft px-3 py-2 text-[13px] font-semibold text-ok">
                {s.testsTotal.passed}/{s.testsTotal.total} generated tests pass
                {s.proposalMs != null ? ` · run ${(s.proposalMs / 1000).toFixed(1)} s measured` : ""}
              </p>
            )}
          </div>
          <div className="bg-bg p-4">
            <p className="ui mb-2 text-[14px] font-semibold text-ink">A2A messages</p>
            <A2AFeed s={s} />
          </div>
          <p className="ui px-1 text-[12px] leading-relaxed text-soft">
            Engine: {status?.engine ?? "loading"}. Approval secret: {status?.approvalSecret ?? "loading"}. Durations are measured on the server; the stream is paced so a person can follow it.
          </p>
        </aside>

        {/* Right: the run, section by section */}
        <main className="min-w-0 space-y-5">
          <Section id="setup" title="Set up the run" aside={<span className="ui text-[13px] text-muted">Choose a bank, then the circular it received</span>}>
            <RunSetup value={setup} onChange={setSetup} disabled={running} />
          </Section>
          <Section id="mesh" title="Agent mesh" aside={<span className="ui text-[13px] text-muted">Conductor, 6 agents, 7 MCP servers · live</span>}>
            <AgentMesh s={s} />
          </Section>
          <Section id="claude" title="Claude, live" aside={<span className="ui text-[13px] text-muted">{s.meta?.path === "llm" ? `Streaming from ${s.meta.llmModel}` : "Extractor and Author calls"}</span>}>
            <LlmPanel s={s} enabled={llmOk} model={status?.llm.model} />
          </Section>
          <Section id="circular" title="1 · Circular and applicability" aside={<span className="ui text-[13px] text-muted">Reader</span>}>
            <ClausesPanel s={s} />
          </Section>
          <Section id="obligations" title="2 · Obligations" aside={<span className="ui text-[13px] text-muted">Extractor</span>}>
            <ObligationsPanel s={s} />
          </Section>
          <Section id="mapping" title="3 · Rules and policies affected" aside={<span className="ui text-[13px] text-muted">Mapper</span>}>
            <MappingPanel s={s} />
          </Section>
          <Section id="redline" title="3b · Internal policy redline" aside={<span className="ui text-[13px] text-muted">Mapper · for Compliance</span>}>
            <PolicyRedline s={s} />
          </Section>
          <Section id="drafts" title="4 · Drafts, objections and tests" aside={<span className="ui text-[13px] text-muted">Author and Validator</span>}>
            <DraftsPanel s={s} previousYaml={previousYaml} />
          </Section>
          <Section id="backtest" title="5 · Backtest and impact" aside={<span className="ui text-[13px] text-muted">Validator · 90 synthetic days</span>}>
            <BacktestPanel s={s} />
          </Section>
          <Section id="whatif" title="5b · Impact in plain words, and what if" aside={<span className="ui text-[13px] text-muted">Deterministic · same compiled SQL</span>}>
            <div className="space-y-6">
              <ImpactNarrative s={s} />
              <WhatIf s={s} />
            </div>
          </Section>
          <Section id="approval" title="6 · Two-person approval" aside={<span className="ui text-[13px] text-muted">Humans</span>}>
            <ApprovalForms s={s} bankName={bank.short} onSign={sign} signing={signing} tamper={tamper} setTamper={setTamper} drift={drift} setDrift={setDrift} onRelease={release} />
          </Section>
          <Section id="rollout" title="7 · Rollout and Sentinel" aside={<a href={site} target={`niyam-bank-${bank.key}`} rel="noopener" className="ui link text-[13px] text-accent">Watch it live on {bank.short}&apos;s site ↗</a>}>
            <RolloutPanel s={s} />
          </Section>
          <Section id="thread" title="8 · Golden Thread" aside={<span className="ui text-[13px] text-muted">Alert to circular</span>}>
            <ThreadPanel s={s} />
          </Section>
          <Section id="audit" title="9 · Audit pack for inspection" aside={<span className="ui text-[13px] text-muted">Tamper-evident · synthetic</span>}>
            <AuditPack s={s} />
          </Section>
          <Section id="graph" title="10 · Regulatory knowledge graph" aside={<span className="ui text-[13px] text-muted">Click any node</span>}>
            <GraphPanel />
          </Section>
          <Section id="tools" title="11 · MCP tool calls" aside={<span className="ui text-[13px] text-muted">7 servers, allowlisted</span>}>
            <McpPanel s={s} />
          </Section>
        </main>
      </div>
    </div>
  );
}
