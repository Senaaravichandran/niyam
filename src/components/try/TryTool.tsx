"use client";

import { useEffect, useId, useState } from "react";
import type { EntityType } from "@/niyam/data/bankProfile";
import { ENTITY_LABEL } from "@/niyam/data/bankProfile";
import { Results, type AnalyzeResult } from "./Results";
import { SAMPLES } from "./samples";

const ENTITIES: EntityType[] = ["UCB", "NBFC-ML", "NBFC-UL", "SCB"];
const MAX_CHARS = 20_000;

type LlmStatus = { state: "loading" } | { state: "ready"; available: boolean; model?: string } | { state: "error" };

export function TryTool() {
  const ids = { text: useId(), entity: useId(), llm: useId(), llmHelp: useId(), sample: useId() };
  const [sampleId, setSampleId] = useState(SAMPLES[0].id);
  const [text, setText] = useState(SAMPLES[0].text);
  const [entity, setEntity] = useState<EntityType>(SAMPLES[0].entity);
  const [useLlm, setUseLlm] = useState(false);
  const [llm, setLlm] = useState<LlmStatus>({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: { llm?: { available?: boolean; model?: string } }) => {
        if (live) setLlm({ state: "ready", available: Boolean(s.llm?.available), model: s.llm?.model });
      })
      .catch(() => live && setLlm({ state: "error" }));
    return () => {
      live = false;
    };
  }, []);

  const llmOn = llm.state === "ready" && llm.available;
  const sample = SAMPLES.find((s) => s.id === sampleId);
  const tooLong = text.length > MAX_CHARS;

  function pick(id: string) {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setSampleId(id);
    setText(s.text);
    setEntity(s.entity);
    setResult(null);
    setError(null);
  }

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || tooLong) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, entityType: entity, useLlm: llmOn && useLlm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setResult(data as AnalyzeResult);
      requestAnimationFrame(() => document.getElementById("try-results")?.scrollIntoView({ block: "start" }));
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={analyze} className="wrap grid gap-8 pb-16 lg:grid-cols-12" aria-label="Analyse a circular">
        <div className="lg:col-span-8">
          <label htmlFor={ids.text} className="ui block text-[15px] font-semibold text-ink">
            Circular text
          </label>
          <p className="ui mt-1 text-[13px] text-muted">
            Paste a circular or a few paragraphs. RBI numbering (&quot;4. Heading. text&quot; and &quot;(a) text&quot;) segments best; plain paragraphs also work.
          </p>
          <textarea
            id={ids.text}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSampleId("");
            }}
            rows={22}
            spellCheck={false}
            aria-describedby={`${ids.text}-count`}
            className="code mt-3 block w-full resize-y border-0 bg-surface p-4 text-ink outline-none focus-visible:outline-3 focus-visible:outline-accent"
          />
          <p id={`${ids.text}-count`} className={`ui num mt-1 text-right text-[12.5px] ${tooLong ? "text-bad" : "text-muted"}`}>
            {text.length.toLocaleString("en-IN")} of {MAX_CHARS.toLocaleString("en-IN")} characters
          </p>
        </div>

        <div className="space-y-8 lg:col-span-4">
          <fieldset className="m-0 border-0 p-0">
            <legend className="ui p-0 text-[15px] font-semibold text-ink">Start from a sample</legend>
            <div className="mt-3 grid gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s.id)}
                  aria-pressed={sampleId === s.id}
                  className={`ui cursor-pointer border-0 px-4 py-3 text-left text-[15px] font-semibold transition-colors ${
                    sampleId === s.id ? "bg-navy text-on-navy" : "bg-surface text-ink hover:bg-surface-2"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {sample && <p className="ui mt-3 text-[13px] leading-relaxed text-muted">{sample.note}</p>}
          </fieldset>

          <div>
            <label htmlFor={ids.entity} className="ui block text-[15px] font-semibold text-ink">
              Your entity type
            </label>
            <select
              id={ids.entity}
              value={entity}
              onChange={(e) => setEntity(e.target.value as EntityType)}
              className="ui mt-2 block w-full cursor-pointer border-0 bg-surface px-3 py-3 text-[15px] text-ink"
            >
              {ENTITIES.map((e) => (
                <option key={e} value={e}>
                  {e}: {ENTITY_LABEL[e]}
                </option>
              ))}
            </select>
            <p className="ui mt-2 text-[13px] text-muted">Clauses scoped to other entity types are marked not applicable.</p>
          </div>

          <div>
            <div className="flex items-start gap-3">
              <input
                id={ids.llm}
                type="checkbox"
                checked={llmOn && useLlm}
                disabled={!llmOn}
                onChange={(e) => setUseLlm(e.target.checked)}
                aria-describedby={ids.llmHelp}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
              />
              <label htmlFor={ids.llm} className={`ui text-[15px] font-semibold ${llmOn ? "text-ink" : "text-muted"}`}>
                Use Claude for extraction
              </label>
            </div>
            <p id={ids.llmHelp} className="ui mt-2 text-[13px] leading-relaxed text-muted">
              {llm.state === "loading" && "Checking whether this deployment has a Claude API key."}
              {llm.state === "error" && "Could not reach /api/status, so Claude is off. The rule-based extractor runs."}
              {llm.state === "ready" &&
                (llm.available
                  ? `Claude (${llm.model}) proposes obligations; every span is still checked as an exact substring of its clause, and anything that fails is rejected, not repaired. Limited to 4 runs per 10 minutes.`
                  : "Off: this deployment has no ANTHROPIC_API_KEY. The rule-based extractor reads comparator phrases deterministically.")}
            </p>
          </div>

          <div>
            <button type="submit" className="btn w-full justify-center" disabled={busy || !text.trim() || tooLong}>
              {busy ? "Analysing" : "Analyse"}
            </button>
            <p className="ui mt-2 text-[13px] text-muted">Analysis only. Nothing is stored, approved or deployed.</p>
          </div>
        </div>
      </form>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="wrap ui mb-16">
            <span className="block bg-bad-soft px-4 py-3 text-[15px] text-bad">Could not analyse: {error}</span>
          </p>
        )}
        {busy && !result && <p className="wrap ui pb-16 text-[15px] text-muted">Reading clauses, extracting obligations, running boundary tests.</p>}
        {result && <Results r={result} />}
      </div>
    </>
  );
}
