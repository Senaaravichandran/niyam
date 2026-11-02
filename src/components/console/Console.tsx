"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { bankByKey, bankSiteUrl, resolveBank } from "@/niyam/data/banks";
import { toYaml } from "@/niyam/dsl/schema";
import type { ApprovalView, ReleaseBundle } from "@/niyam/events";
import { Wordmark } from "@/components/Logo";
import { BankRelay } from "@/components/bank/relay";
import {
  A2AFeed,
  BacktestPanel,
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
import { LiveView } from "./LiveView";
import { ApprovalForms, type ReviewInput } from "./Approval";
import { LlmPanel } from "./LlmPanel";
import { DEFAULT_SETUP, RunSetup, setupBank, type SetupValue } from "./RunSetup";
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

/** The detail sections, behind "Show full details". */
const NAV = [
  ["mesh", "Agent mesh"],
  ["claude", "Claude calls"],
  ["circular", "Circular"],
  ["obligations", "Obligations"],
  ["mapping", "Mapping"],
  ["redline", "Policy redline"],
  ["drafts", "Drafts and tests"],
  ["backtest", "Backtest"],
  ["whatif", "What if"],
  ["thread", "Golden Thread"],
  ["audit", "Audit pack"],
  ["graph", "Knowledge graph"],
  ["tools", "MCP tools"],
  ["steps", "Steps and A2A"],
] as const;

export function Console() {
  const [s, dispatch] = useReducer(reducer, initialState);
  const [status, setStatus] = useState<Status | null>(null);
  const [path, setPath] = useState<"rule-based" | "llm">("rule-based");
  const [signing, setSigning] = useState<string | null>(null);
  const [tamper, setTamper] = useState(false);
  const [drift, setDrift] = useState(true);
  const [setup, setSetup] = useState<SetupValue>(DEFAULT_SETUP);
  // Follow along: the page scrolls to whatever the agents are doing, until the visitor scrolls
  // by hand. It turns back on with the next Run or Release.
  const [follow, setFollow] = useState(true);
  useEffect(() => {
    const stop = () => setFollow(false);
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(e.key) && !(e.target instanceof HTMLElement && e.target.closest("input, textarea, select"))) stop();
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const abort = useRef<AbortController | null>(null);
  const header = useRef<HTMLDivElement>(null);
  const relay = useRef<BankRelay | null>(null);
  const [origin, setOrigin] = useState<string | undefined>();
  const bank = s.bundle ? resolveBank(s.bundle.bankKey, s.bundle.customBank) : setupBank(setup);
  const [details, setDetails] = useState(false);
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
    setFollow(true);
    const own = setup.source === "bank-pdf" && setup.pdfOf ? bankByKey(setup.pdfOf).circular.title : undefined;
    const circular = { ref: setup.ref, text: setup.text, synthetic: true, ...(own ? { title: own } : {}) };
    try {
      await streamEvents("/api/run", { path, bank: setup.bank, customBank: setup.bank === "custom" ? setup.custom : undefined, circular }, (event) => dispatch({ type: "event", event }), ac.signal);
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
    setFollow(true);
    // Open the bank's own rule-engine site and stream the rollout to it as it happens.
    const r = relay.current;
    r?.open(site, bank.key);
    const calls = s.llmCalls.filter((c) => c.status === "done");
    r?.send({
      niyam: 1,
      kind: "init",
      bank: bank.key,
      bundle: s.bundle,
      approvals: s.approvals,
      path: s.meta?.path,
      bankDef: { key: bank.key, short: bank.short, kind: bank.kind, profile: bank.profile, rules: bank.rules, policies: bank.policies, brand: bank.brand, host: bank.host, circular: bank.circular },
      llm: s.meta?.path === "llm" ? { model: s.meta.llmModel ?? "", calls: calls.length, agents: [...new Set(calls.map((c) => c.agent))], inputTokens: calls.reduce((n, c) => n + (c.inputTokens ?? 0), 0), outputTokens: calls.reduce((n, c) => n + (c.outputTokens ?? 0), 0), costUsd: calls.reduce((n, c) => n + (c.costUsd ?? 0), 0) } : undefined,
    });
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

  // Follow along: the live view while agents work, the approval gate when they stop, the rollout after.
  const followTarget = s.status === "running" ? "live" : s.status === "awaiting" ? "approval" : s.status === "idle" || s.status === "error" ? "" : "rollout";
  useEffect(() => {
    if (!follow || !followTarget) return;
    const timers = [250, 1100].map((ms) => setTimeout(() => scrollTo(followTarget), ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followTarget, follow]);

  // Open the details and jump to one section.
  function openDetail(id: string) {
    setFollow(false);
    setDetails(true);
    setTimeout(() => scrollTo(id), 80);
  }

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
      </div>

      <div className="wrap pt-6">
        <h1 className="text-[clamp(24px,2.4vw,32px)] tracking-[-0.03em]">Pipeline console</h1>
        <p className="ui mt-1 text-[14px] text-muted">
          {setup.ref} · {bank.profile.name.replace(/\s*\(SYNTHETIC\)\s*$/i, "")} · {(s.meta?.path ?? path) === "llm" ? "Claude live" : "rule-based"} · synthetic bank data
        </p>
      </div>

      <main className="wrap min-w-0 space-y-5 pb-24 pt-5">
        <Section id="setup" title="1 · Set up the run" aside={<span className="ui text-[13px] text-muted">Choose or add a bank, then the circular it received</span>}>
          <RunSetup value={setup} onChange={setSetup} disabled={running} />
        </Section>

        <Section id="live" title="2 · Watch the agents work" aside={<span className="ui text-[13px] text-muted">{bank.short} · {(s.meta?.path ?? path) === "llm" ? `Claude live (${status?.llm.model ?? "LLM"})` : "rule-based"}</span>}>
          <div className="space-y-4">
            {s.error && <p className="ui bg-bad-soft p-3 text-[14px] text-bad">{s.error}</p>}
            {s.meta?.note && <p className="ui bg-warn-soft p-3 text-[14px] text-warn">{s.meta.note}</p>}
            <LiveView s={s} bank={bank} model={s.meta?.llmModel ?? status?.llm.model} onOpen={openDetail} />
            {s.meta?.path === "llm" && <LlmPanel s={s} enabled={llmOk} model={status?.llm.model} />}
          </div>
        </Section>

        <Section id="approval" title="3 · Two-person approval" aside={<span className="ui text-[13px] text-muted">Maker and checker</span>}>
          <ApprovalForms s={s} bankName={bank.short} onSign={sign} signing={signing} tamper={tamper} setTamper={setTamper} drift={drift} setDrift={setDrift} onRelease={release} />
        </Section>

        <Section id="rollout" title={`4 · Release at ${bank.short}`} aside={<a href={site} target={`niyam-bank-${bank.key}`} rel="noopener" className="ui link text-[13px] text-accent">Watch it live on {bank.short}&apos;s site ↗</a>}>
          <RolloutPanel s={s} />
        </Section>

        <div className="bg-bg p-4 sm:p-5">
          <button type="button" onClick={() => setDetails(!details)} aria-expanded={details} className="ui flex w-full cursor-pointer items-center justify-between text-left">
            <span>
              <span className="block text-[18px] font-semibold text-ink">{details ? "Hide full details" : "Show full details"}</span>
              <span className="block text-[13.5px] text-muted">Every clause, obligation, mapping, rule diff, test, backtest, Golden Thread, audit pack, knowledge graph and MCP call</span>
            </span>
            <span aria-hidden="true" className={`text-[14px] text-muted transition-transform ${details ? "rotate-180" : ""}`}>▼</span>
          </button>
          {details && (
            <nav className="scrollbar-none mt-3 flex gap-1 overflow-x-auto" aria-label="Detail sections">
              {NAV.map(([id, label]) => (
                <button key={id} type="button" onClick={() => scrollTo(id)} className="ui shrink-0 cursor-pointer bg-surface px-2.5 py-1 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink">
                  {label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {details && (
          <>
            <Section id="mesh" title="Agent mesh" aside={<span className="ui text-[13px] text-muted">Conductor, 6 agents, 7 MCP servers</span>}>
              <AgentMesh s={s} />
            </Section>
            <Section id="claude" title="Claude calls" aside={<span className="ui text-[13px] text-muted">Extractor and Author</span>}>
              <LlmPanel s={s} enabled={llmOk} model={status?.llm.model} />
            </Section>
            <Section id="circular" title="Circular and applicability" aside={<span className="ui text-[13px] text-muted">Reader</span>}>
              <ClausesPanel s={s} />
            </Section>
            <Section id="obligations" title="Obligations" aside={<span className="ui text-[13px] text-muted">Extractor</span>}>
              <ObligationsPanel s={s} />
            </Section>
            <Section id="mapping" title="Rules and policies affected" aside={<span className="ui text-[13px] text-muted">Mapper</span>}>
              <MappingPanel s={s} />
            </Section>
            <Section id="redline" title="Internal policy redline" aside={<span className="ui text-[13px] text-muted">Mapper · for Compliance</span>}>
              <PolicyRedline s={s} />
            </Section>
            <Section id="drafts" title="Drafts, objections and tests" aside={<span className="ui text-[13px] text-muted">Author and Validator</span>}>
              <DraftsPanel s={s} previousYaml={previousYaml} />
            </Section>
            <Section id="backtest" title="Backtest and impact" aside={<span className="ui text-[13px] text-muted">Validator · 90 synthetic days</span>}>
              <BacktestPanel s={s} />
            </Section>
            <Section id="whatif" title="Impact in plain words, and what if" aside={<span className="ui text-[13px] text-muted">Same compiled SQL</span>}>
              <div className="space-y-6">
                <ImpactNarrative s={s} />
                <WhatIf s={s} />
              </div>
            </Section>
            <Section id="thread" title="Golden Thread" aside={<span className="ui text-[13px] text-muted">Alert to circular</span>}>
              <ThreadPanel s={s} />
            </Section>
            <Section id="audit" title="Audit pack for inspection" aside={<span className="ui text-[13px] text-muted">Tamper-evident · synthetic</span>}>
              <AuditPack s={s} />
            </Section>
            <Section id="graph" title="Regulatory knowledge graph" aside={<span className="ui text-[13px] text-muted">Click any node</span>}>
              <GraphPanel />
            </Section>
            <Section id="tools" title="MCP tool calls" aside={<span className="ui text-[13px] text-muted">7 servers, allowlisted</span>}>
              <McpPanel s={s} />
            </Section>
            <Section id="steps" title="Agent steps and A2A messages" aside={<span className="ui text-[13px] text-muted">Measured on the server</span>}>
              <div className="grid gap-6 lg:grid-cols-2">
                <Timeline s={s} />
                <A2AFeed s={s} />
              </div>
              <p className="ui mt-4 text-[12.5px] text-soft">
                Engine: {status?.engine ?? "loading"}. Approval secret: {status?.approvalSecret ?? "loading"}. The stream is paced so a person can follow it.
              </p>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
