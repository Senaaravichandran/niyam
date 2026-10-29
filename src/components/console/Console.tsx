"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { EXISTING_RULES } from "@/niyam/data/seed";
import { toYaml } from "@/niyam/dsl/schema";
import type { ApprovalView, ReleaseBundle } from "@/niyam/events";
import {
  A2AFeed,
  ApprovalPanel,
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
import { initialState, reducer, streamEvents } from "./state";

interface Status {
  llm: { available: boolean; model: string };
  engine: string;
  approvalSecret: string;
}

const NAV = [
  ["circular", "Circular"],
  ["obligations", "Obligations"],
  ["mapping", "Mapping"],
  ["drafts", "Drafts and tests"],
  ["backtest", "Backtest"],
  ["approval", "Approval"],
  ["rollout", "Rollout"],
  ["thread", "Golden Thread"],
  ["tools", "MCP tools"],
] as const;

export function Console() {
  const [s, dispatch] = useReducer(reducer, initialState);
  const [status, setStatus] = useState<Status | null>(null);
  const [path, setPath] = useState<"rule-based" | "llm">("rule-based");
  const [signing, setSigning] = useState<string | null>(null);
  const [tamper, setTamper] = useState(false);
  const [drift, setDrift] = useState(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const previousYaml = useMemo(() => Object.fromEntries(EXISTING_RULES.map((r) => [r.rule_id, toYaml(r)])), []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function run() {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    dispatch({ type: "start" });
    try {
      await streamEvents("/api/run", { path }, (event) => dispatch({ type: "event", event }), ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") dispatch({ type: "error", message: (e as Error).message });
    }
  }

  async function sign(approverId: string) {
    if (!s.bundle) return;
    setSigning(approverId);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId, drafts: s.bundle.drafts.map((d) => ({ ruleId: d.ruleId, version: d.version, yaml: d.yaml })) }),
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
    const bundle: ReleaseBundle = tamper
      ? { ...s.bundle, drafts: s.bundle.drafts.map((d) => (d.ruleId === "SYN-EXP-012" ? { ...d, yaml: d.yaml.replace("value: 12", "value: 13") } : d)) }
      : s.bundle;
    dispatch({ type: "start_release" });
    setTimeout(() => scrollTo("rollout"), 150);
    const ac = new AbortController();
    abort.current = ac;
    try {
      await streamEvents("/api/release", { bundle, tokens, injectDrift: drift }, (event) => dispatch({ type: "event", event }), ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") dispatch({ type: "error", message: (e as Error).message });
    }
  }

  // Follow the run: bring each new section into view as it fills.
  const lastSection = useRef<string | null>(null);
  useEffect(() => {
    if (s.status !== "running") return;
    const target = s.backtest ? "approval" : s.drafts.length ? "drafts" : s.mapping ? "mapping" : s.obligations.length ? "obligations" : s.clauses.length ? "circular" : null;
    if (target && target !== lastSection.current) {
      lastSection.current = target;
      scrollTo(target);
    }
  }, [s.status, s.clauses.length, s.obligations.length, s.mapping, s.drafts.length, s.backtest]);
  useEffect(() => {
    if (s.status === "released" && s.thread) setTimeout(() => scrollTo("thread"), 400);
  }, [s.status, s.thread]);

  const running = s.status === "running" || s.status === "releasing";
  const llmOk = status?.llm.available ?? false;
  const pathRan = s.meta?.path;

  return (
    <div className="min-h-svh bg-surface">
      {/* Control bar */}
      <div className="sticky top-16 z-20 bg-surface">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <h1 className="text-[clamp(22px,2.2vw,30px)] tracking-[-0.03em]">Pipeline console</h1>
            <p className="ui truncate text-[13px] text-muted">
              Circular RBI-SYN-2026-017 · Demo Urban Co-operative Bank · all data synthetic
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="ui flex bg-bg p-1 text-[13px]" role="radiogroup" aria-label="Execution path">
              <button
                type="button"
                role="radio"
                aria-checked={path === "rule-based"}
                onClick={() => setPath("rule-based")}
                className={`cursor-pointer px-3 py-1.5 transition-colors ${path === "rule-based" ? "bg-ink text-white" : "bg-transparent text-ink hover:bg-surface"}`}
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
                className={`px-3 py-1.5 transition-colors ${path === "llm" ? "bg-ink text-white" : llmOk ? "cursor-pointer bg-transparent text-ink hover:bg-surface" : "cursor-not-allowed bg-transparent text-soft"}`}
              >
                Claude {llmOk ? "" : "(no key)"}
              </button>
            </div>
            <button type="button" className="btn" onClick={run} disabled={running}>
              {s.status === "running" ? "Running…" : s.status === "idle" ? "Run the pipeline" : "Run again"}
            </button>
          </div>
        </div>
        <nav className="wrap scrollbar-none flex gap-1 overflow-x-auto pb-2" aria-label="Console sections">
          {NAV.map(([id, label]) => (
            <button key={id} type="button" onClick={() => scrollTo(id)} className="ui shrink-0 cursor-pointer bg-transparent px-2.5 py-1 text-[13px] text-muted transition-colors hover:bg-bg hover:text-ink">
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="wrap grid gap-4 pb-24 pt-2 lg:grid-cols-[340px_1fr]">
        {/* Left: run status */}
        <aside className="space-y-4 lg:sticky lg:top-[184px] lg:max-h-[calc(100svh-200px)] lg:self-start lg:overflow-y-auto">
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
            <div className="mt-3">
              <Timeline s={s} />
            </div>
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
        <main className="space-y-4">
          <Section id="circular" title="1 · Circular and applicability" aside={<span className="ui text-[13px] text-muted">Reader</span>}>
            <ClausesPanel s={s} />
          </Section>
          <Section id="obligations" title="2 · Obligations" aside={<span className="ui text-[13px] text-muted">Extractor</span>}>
            <ObligationsPanel s={s} />
          </Section>
          <Section id="mapping" title="3 · Rules and policies affected" aside={<span className="ui text-[13px] text-muted">Mapper</span>}>
            <MappingPanel s={s} />
          </Section>
          <Section id="drafts" title="4 · Drafts, objections and tests" aside={<span className="ui text-[13px] text-muted">Author and Validator</span>}>
            <DraftsPanel s={s} previousYaml={previousYaml} />
          </Section>
          <Section id="backtest" title="5 · Backtest and impact" aside={<span className="ui text-[13px] text-muted">Validator · 90 synthetic days</span>}>
            <BacktestPanel s={s} />
          </Section>
          <Section id="approval" title="6 · Two-person approval" aside={<span className="ui text-[13px] text-muted">Humans</span>}>
            <ApprovalPanel s={s} onSign={sign} signing={signing} tamper={tamper} setTamper={setTamper} drift={drift} setDrift={setDrift} onRelease={release} />
          </Section>
          <Section id="rollout" title="7 · Rollout and Sentinel" aside={<span className="ui text-[13px] text-muted">Release</span>}>
            <RolloutPanel s={s} />
          </Section>
          <Section id="thread" title="8 · Golden Thread" aside={<span className="ui text-[13px] text-muted">Alert to circular</span>}>
            <ThreadPanel s={s} />
          </Section>
          <Section id="tools" title="9 · MCP tool calls" aside={<span className="ui text-[13px] text-muted">7 servers, allowlisted</span>}>
            <McpPanel s={s} />
          </Section>
        </main>
      </div>
    </div>
  );
}
