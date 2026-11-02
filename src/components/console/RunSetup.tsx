"use client";

import { useEffect, useRef, useState } from "react";
import { ENTITY_LABEL } from "@/niyam/data/bankProfile";
import { BANKS, bankByKey, bankSiteUrl, type BankKey } from "@/niyam/data/banks";

export interface SetupValue {
  bank: BankKey;
  /** Where the circular text came from. */
  source: "bank-pdf" | "upload" | "paste";
  ref: string;
  text: string;
  /** How the text was read, shown to the user. */
  intake?: string;
}

const first = bankByKey("ghi");
export const DEFAULT_SETUP: SetupValue = { bank: first.key, source: "bank-pdf", ref: first.circular.ref, text: first.circular.text, intake: "Built-in text (loading the PDF…)" };

const DATA: [string, string][] = [
  ["The banks", "ABC Bank, DEF Bank, GHI Co-operative Bank and JKL Finance are fictional. Each has its own licence type, Tier 1 capital, live rules and internal policy."],
  ["The circulars", "Each bank's circular is a synthetic PDF written in RBI's style (in /bank-rules), with limits chosen so nobody mistakes them for real RBI limits. NIYAM reads the PDF's text layer the same way it would read RBI's."],
  ["The loan books", "Each bank has its own 90-day synthetic loan book (706 borrowers, 48 connected groups) generated from a fixed seed and scaled to its capital. No real customer data is used anywhere."],
  ["The approvers", "Two roles, maker and checker. You type the names, IDs and reasons; they are signed into the approval token."],
  ["Your own circular", "Upload a PDF with a text layer, a Word file or plain text, or paste text. Numbered paragraphs work best. Scanned PDFs need OCR, which this deployment does not run."],
  ["Real numbers", "Only the RBI statistics on the Problem and Research pages are real, each cited to its source."],
];

function refFrom(text: string, fallback: string) {
  const m = text.match(/RBI\/\d{4}-\d{2}\/[A-Z0-9-]+/);
  const raw = m ? m[0] : fallback;
  return raw.toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "CIRC-UPLOAD-001";
}

async function extract(file: File): Promise<{ text: string; method: string; pages?: number; chars: number; truncated?: boolean }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/extract", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Could not read the file (${res.status})`);
  return data;
}

const METHOD: Record<string, string> = { "pdf-text-layer": "PDF text layer", docx: "Word document", "plain-text": "plain text" };

export function RunSetup({ value, onChange, disabled }: { value: SetupValue; onChange: (v: SetupValue) => void; disabled: boolean }) {
  const [showData, setShowData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const bank = bankByKey(value.bank);
  const [origin, setOrigin] = useState<string | undefined>();
  useEffect(() => setOrigin(window.location.origin), []);

  /** Reads the bank's own circular PDF through the same intake as an upload. */
  async function loadBankPdf(key: BankKey) {
    const b = bankByKey(key);
    setBusy(true);
    setErr(null);
    onChange({ bank: key, source: "bank-pdf", ref: b.circular.ref, text: b.circular.text, intake: "Reading the PDF…" });
    try {
      const blob = await (await fetch(b.circular.pdf)).blob();
      const name = b.circular.pdf.split("/").pop()!;
      const r = await extract(new File([blob], name, { type: "application/pdf" }));
      onChange({ bank: key, source: "bank-pdf", ref: b.circular.ref, text: r.text, intake: `${name} · ${METHOD[r.method] ?? r.method}${r.pages ? ` · ${r.pages} page${r.pages > 1 ? "s" : ""}` : ""} · ${r.chars.toLocaleString()} characters` });
    } catch (e) {
      setErr(`${(e as Error).message}. Using the circular's built-in text instead.`);
      onChange({ bank: key, source: "bank-pdf", ref: b.circular.ref, text: b.circular.text, intake: "Built-in text" });
    } finally {
      setBusy(false);
    }
  }

  // Read the default bank's PDF once on first load.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void loadBankPdf(value.bank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(f: File) {
    setBusy(true);
    setErr(null);
    try {
      const r = await extract(f);
      const fallback = f.name.replace(/\.[a-z0-9]+$/i, "");
      onChange({ ...value, source: "upload", ref: refFrom(r.text, fallback), text: r.text, intake: `${f.name} · ${METHOD[r.method] ?? r.method}${r.pages ? ` · ${r.pages} page${r.pages > 1 ? "s" : ""}` : ""} · ${r.chars.toLocaleString()} characters${r.truncated ? " (first 20,000 kept)" : ""}` });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const tab = (active: boolean) => `cursor-pointer px-3 py-1.5 text-[13.5px] transition-colors disabled:cursor-not-allowed ${active ? "bg-ink text-white" : "bg-bg text-ink hover:bg-surface-2"}`;
  const site = bankSiteUrl(bank, origin);

  return (
    <div data-ui className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
      {/* Your bank */}
      <div className="bg-surface p-5">
        <p className="text-[17px] font-semibold text-ink">1 · Your bank</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Bank">
          {BANKS.map((b) => {
            const on = b.key === value.bank;
            return (
              <button
                key={b.key}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled || busy}
                onClick={() => !on && loadBankPdf(b.key)}
                className={`cursor-pointer p-3 text-left transition-colors disabled:cursor-not-allowed ${on ? "bg-ink text-white" : "bg-bg text-ink hover:bg-surface-2"}`}
              >
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ background: b.brand }} aria-hidden="true" />
                  {b.short}
                </span>
                <span className={`mt-0.5 block text-[12.5px] ${on ? "text-white/75" : "text-muted"}`}>
                  {b.kind} · {ENTITY_LABEL[b.profile.entityType]}
                </span>
              </button>
            );
          })}
        </div>

        <dl className="m-0 mt-4 grid grid-cols-3 gap-px bg-surface-2 text-[13px]">
          {[
            ["Tier 1 capital", `₹${bank.profile.tier1CapitalCr.toLocaleString("en-IN")} cr`],
            ["State", bank.profile.state],
            ["Licence", bank.profile.entityType],
          ].map(([k, v]) => (
            <div key={k} className="bg-bg px-3 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="m-0 font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-[13px] text-muted">Live rules today</p>
        <ul className="m-0 mt-1 space-y-1 p-0">
          {bank.rules.map((r) => (
            <li key={r.rule_id} className="list-none bg-bg px-3 py-2 text-[14px] text-ink">
              <b>{r.rule_id}</b> · {r.title}
              <span className="block text-[13px] text-muted">
                fires when <span className="code">{r.when.metric}</span> {r.when.op} {r.when.value}%{r.unless ? `, unless ${r.unless.replace("_", " ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-muted">Internal policy</p>
        <ul className="m-0 mt-1 space-y-1 p-0">
          {bank.policies.map((p) => (
            <li key={p.id} className="list-none bg-bg px-3 py-2 text-[14px] leading-snug text-ink">
              <b>
                {p.policy.split(" ")[0]} §{p.section}
              </b>{" "}
              {p.text}
            </li>
          ))}
        </ul>
        <a href={site} target={`niyam-bank-${bank.key}`} rel="noopener" className="ui link mt-4 inline-block text-[14px] font-semibold text-accent">
          Open {bank.short}&apos;s rule-engine site ↗
        </a>
      </div>

      {/* The new circular */}
      <div className="flex flex-col bg-surface p-5">
        <p className="text-[17px] font-semibold text-ink">2 · The circular it just received</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={disabled || busy} onClick={() => loadBankPdf(bank.key)} className={tab(value.source === "bank-pdf")}>
            {bank.short}&apos;s circular (PDF)
          </button>
          <button type="button" disabled={disabled || busy} onClick={() => file.current?.click()} className={tab(value.source === "upload")}>
            Upload PDF, Word or text
          </button>
          <button type="button" disabled={disabled || busy} onClick={() => onChange({ ...value, source: "paste", ref: "CIRC-PASTED-001", text: "", intake: "Pasted text" })} className={tab(value.source === "paste")}>
            Paste text
          </button>
          <input ref={file} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className="text-muted">
            {busy ? <span className="pulse text-accent">Reading the document…</span> : value.intake}
          </span>
          {value.source === "bank-pdf" && (
            <a href={bank.circular.pdf} target="_blank" rel="noreferrer" className="link text-accent">
              View the PDF ↗
            </a>
          )}
        </div>
        {err && (
          <p role="alert" className="mt-2 bg-bad-soft px-3 py-2 text-[13px] text-bad">
            {err}
          </p>
        )}
        <label htmlFor="circ" className="sr-only">
          Circular text
        </label>
        <textarea
          id="circ"
          value={value.text}
          disabled={disabled || busy}
          placeholder="Paste a circular here. Numbered paragraphs (1., 2., (a), (b)) work best."
          onChange={(e) => onChange({ ...value, source: value.source === "bank-pdf" ? "paste" : value.source, ref: value.source === "bank-pdf" ? refFrom(e.target.value, "CIRC-EDITED-001") : refFrom(e.target.value, value.ref), text: e.target.value.slice(0, 20_000), intake: value.source === "upload" ? value.intake : "Edited text" })}
          className="code mt-3 min-h-[300px] w-full flex-1 resize-y bg-bg p-3 text-[12.5px] leading-[1.55] text-ink outline-none focus:bg-white"
        />
        <p className="mt-2 flex justify-between text-[12px] text-muted">
          <span>
            Reference: <span className="code text-ink">{value.ref}</span>
          </span>
          <span>{value.text.length.toLocaleString()} / 20,000 characters</span>
        </p>
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
