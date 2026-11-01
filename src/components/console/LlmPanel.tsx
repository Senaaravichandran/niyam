"use client";

import { useEffect, useRef } from "react";
import type { LlmCall, RunState } from "./state";

const AGENT = { extractor: "Extractor", author: "Author" } as Record<string, string>;

function Stream({ text, live }: { text: string; live: boolean }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);
  return (
    <pre ref={ref} className="m-0 max-h-[180px] overflow-y-auto whitespace-pre-wrap bg-navy px-4 py-3 [overflow-wrap:anywhere] text-[12px] leading-[1.55] text-on-navy">
      {text || (live ? "Waiting for the first tokens…" : "")}
      {live && <span className="pulse ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-[#9db4ee]" />}
    </pre>
  );
}

function Call({ c }: { c: LlmCall }) {
  const live = c.status === "running";
  return (
    <article data-ui className={`rise ${c.status === "error" && !c.text ? "bg-warn-soft" : "bg-surface"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 ${live ? "pulse bg-accent" : c.status === "done" ? "bg-ok" : "bg-warn"}`} />
          <p className="text-[14px] font-semibold text-ink">
            {AGENT[c.agent] ?? c.agent} → Claude
            <span className="ml-2 font-normal text-muted">{c.task}</span>
          </p>
        </div>
        <p className="num text-[12.5px] text-muted">
          {live
            ? "writing…"
            : c.status === "done"
              ? `${c.inputTokens ?? 0} in · ${c.outputTokens ?? 0} out · ${((c.ms ?? 0) / 1000).toFixed(1)} s · ~$${(c.costUsd ?? 0).toFixed(4)}`
              : c.error ?? "not completed"}
        </p>
      </div>
      {(c.text || live) && <Stream text={c.text} live={live} />}
      {c.verdict && (
        <div className={`px-4 py-2.5 text-[13px] ${c.verdict.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
          <b>NIYAM checked it:</b> {c.verdict.summary}
          {c.verdict.details?.map((d) => (
            <span key={d} className="block text-ink">
              {d}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function LlmPanel({ s, enabled, model }: { s: RunState; enabled: boolean; model?: string }) {
  const calls = s.llmCalls;
  const done = calls.filter((c) => c.status === "done");
  const tokensIn = done.reduce((a, c) => a + (c.inputTokens ?? 0), 0);
  const tokensOut = done.reduce((a, c) => a + (c.outputTokens ?? 0), 0);
  const cost = done.reduce((a, c) => a + (c.costUsd ?? 0), 0);
  const usedLlm = s.meta?.path === "llm";

  if (!calls.length) {
    return (
      <p className="ui bg-surface px-4 py-6 text-[14px] text-muted">
        {usedLlm
          ? "Claude is about to start. Each call will appear here as it is written."
          : enabled
            ? `Choose “Claude live” and run: the Extractor and Author will call ${model ?? "Claude"}, and you will watch every answer being written, then checked by NIYAM before it is used.`
            : "Claude is not configured on this deployment, so runs use the rule-based path."}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div data-ui className="flex flex-wrap gap-x-6 gap-y-1 bg-bg text-[13px] text-muted">
        <span>
          Model <b className="text-ink">{calls.find((c) => c.model)?.model}</b>
        </span>
        <span>
          Calls <b className="num text-ink">{calls.filter((c) => c.model).length}</b>
        </span>
        <span>
          Tokens <b className="num text-ink">{tokensIn + tokensOut}</b> ({tokensIn} in, {tokensOut} out)
        </span>
        <span>
          Estimated cost <b className="num text-ink">${cost.toFixed(4)}</b>
        </span>
      </div>
      {calls.map((c) => (
        <Call key={c.id} c={c} />
      ))}
      <p className="ui text-[12.5px] text-muted">
        Claude only proposes language: obligations and rule drafts as typed JSON. NIYAM verifies every span, validates every rule against the schema, and the independent Validator still tests each draft before any human sees it.
      </p>
    </div>
  );
}
