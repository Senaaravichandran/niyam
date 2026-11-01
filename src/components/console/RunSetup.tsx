"use client";

import { useRef, useState } from "react";
import type { EntityType } from "@/niyam/data/bankProfile";
import { ENTITY_LABEL } from "@/niyam/data/bankProfile";
import { EXISTING_RULES, POLICIES } from "@/niyam/data/seed";
import { SAMPLES } from "@/components/try/samples";

export interface SetupValue {
  entity: EntityType;
  sampleId: string | "custom";
  ref: string;
  text: string;
}

export const DEFAULT_SETUP: SetupValue = { entity: "UCB", sampleId: "synthetic", ref: "RBI-SYN-2026-017", text: SAMPLES[0].text };

const SAMPLE_REF: Record<string, string> = { synthetic: "RBI-SYN-2026-017", ucb: "RBI-2019-20-171", nbfc: "NBFC-SYN-ILLUSTRATIVE" };

const DATA: [string, string][] = [
  ["The circular", "RBI-SYN-2026-017 is written in RBI's style but fictional, with 10% and 12% limits chosen so nobody mistakes them for RBI's real 15% and 25%. You can also run the paraphrased real RBI/2019-20/171 excerpt, or upload your own."],
  ["The bank", "A synthetic urban co-operative bank with ₹412 crore of Tier 1 capital. Choose another licence type and the Reader re-scopes every clause."],
  ["Its live rules and policy", "Two live rules written for an older synthetic Master Direction, and credit policy POL-CR-07, shown on this page in full."],
  ["Its loan book", "706 borrowers (146 in 48 connected groups, 560 stand-alone), 90 days of daily exposures, generated from a fixed seed so every run is reproducible. No real customer data is used anywhere."],
  ["The approvers", "Two synthetic identities in two roles: a Chief Compliance Officer and a Head of Risk and IT Change."],
  ["Real numbers", "Only the RBI statistics on the Research page are real, each cited to its source."],
];

export function RunSetup({ value, onChange, disabled }: { value: SetupValue; onChange: (v: SetupValue) => void; disabled: boolean }) {
  const [showData, setShowData] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const pick = (id: string) => {
    const sm = SAMPLES.find((x) => x.id === id)!;
    onChange({ entity: sm.entity, sampleId: id, ref: SAMPLE_REF[id] ?? "CIRC-UPLOAD-001", text: sm.text });
  };

  const upload = async (f: File) => {
    const text = (await f.text()).slice(0, 20_000);
    const ref = f.name.replace(/\.[a-z0-9]+$/i, "").toUpperCase().replace(/[^A-Z0-9-]+/g, "-").slice(0, 40) || "CIRC-UPLOAD-001";
    onChange({ ...value, sampleId: "custom", ref, text });
  };

  return (
    <div data-ui className="grid gap-6 xl:grid-cols-2">
      {/* Your bank */}
      <div className="bg-surface p-5">
        <p className="text-[17px] font-semibold text-ink">1 · Your bank</p>
        <label className="mt-3 block text-[13px] text-muted" htmlFor="entity">
          Licence type (decides which clauses bind you)
        </label>
        <select
          id="entity"
          value={value.entity}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, entity: e.target.value as EntityType })}
          className="mt-1 w-full bg-bg px-3 py-2.5 text-[15px] text-ink outline-none"
        >
          {(Object.keys(ENTITY_LABEL) as EntityType[]).map((k) => (
            <option key={k} value={k}>
              {ENTITY_LABEL[k]}
            </option>
          ))}
        </select>
        <p className="mt-4 text-[13px] text-muted">Live rules today</p>
        <ul className="m-0 mt-1 space-y-1 p-0">
          {EXISTING_RULES.map((r) => (
            <li key={r.rule_id} className="list-none bg-bg px-3 py-2 text-[14px] text-ink">
              <b>{r.rule_id}</b> · {r.title}
              <span className="block text-[13px] text-muted">
                fires when <span className="code">{r.when.metric}</span> {r.when.op} {r.when.value}%{r.unless ? `, unless ${r.unless.replace("_", " ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-muted">Internal credit policy</p>
        <ul className="m-0 mt-1 space-y-1 p-0">
          {POLICIES.map((p) => (
            <li key={p.id} className="list-none bg-bg px-3 py-2 text-[14px] leading-snug text-ink">
              <b>§{p.section}</b> {p.text}
            </li>
          ))}
        </ul>
      </div>

      {/* The new circular */}
      <div className="flex flex-col bg-surface p-5">
        <p className="text-[17px] font-semibold text-ink">2 · The new circular</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Circular">
          {SAMPLES.map((sm) => (
            <button
              key={sm.id}
              type="button"
              role="radio"
              aria-checked={value.sampleId === sm.id}
              disabled={disabled}
              onClick={() => pick(sm.id)}
              className={`cursor-pointer px-3 py-1.5 text-[13px] transition-colors ${value.sampleId === sm.id ? "bg-ink text-white" : "bg-bg text-ink hover:bg-surface-2"}`}
            >
              {sm.label}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => file.current?.click()}
            className={`cursor-pointer px-3 py-1.5 text-[13px] transition-colors ${value.sampleId === "custom" ? "bg-ink text-white" : "bg-bg text-ink hover:bg-surface-2"}`}
          >
            Upload .txt
          </button>
          <input ref={file} type="file" accept=".txt,.md,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <p className="mt-2 text-[13px] text-muted">{value.sampleId === "custom" ? "Your text. Paste or edit freely; numbered paragraphs work best." : SAMPLES.find((x) => x.id === value.sampleId)?.note}</p>
        <label htmlFor="circ" className="sr-only">
          Circular text
        </label>
        <textarea
          id="circ"
          value={value.text}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, sampleId: "custom", ref: value.sampleId === "custom" ? value.ref : "CIRC-UPLOAD-001", text: e.target.value.slice(0, 20_000) })}
          className="code mt-3 min-h-[260px] w-full flex-1 resize-y bg-bg p-3 text-[12.5px] leading-[1.55] text-ink outline-none focus:bg-white"
        />
        <p className="mt-2 text-right text-[12px] text-muted">{value.text.length.toLocaleString()} / 20,000 characters</p>
      </div>

      {/* Data provenance */}
      <div className="xl:col-span-2">
        <button
          type="button"
          onClick={() => setShowData(!showData)}
          aria-expanded={showData}
          className="cursor-pointer bg-accent-soft px-4 py-2.5 text-left text-[14px] font-semibold text-accent transition-colors hover:bg-[#d4e0fb]"
        >
          {showData ? "Hide" : "What data is this?"} {showData ? "" : "(for judges: what is real and what is synthetic)"}
        </button>
        {showData && (
          <dl className="rise m-0 mt-2 grid gap-2 md:grid-cols-2">
            {DATA.map(([k, v]) => (
              <div key={k} className="bg-surface px-4 py-3">
                <dt className="text-[14px] font-semibold text-ink">{k}</dt>
                <dd className="m-0 mt-1 text-[14px] leading-relaxed text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
