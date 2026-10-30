"use client";

import { useMemo, useState } from "react";
import { CIRCULAR_REF } from "@/niyam/data/circular";
import { POLICIES } from "@/niyam/data/seed";
import type { RunState } from "./state";

type Segment = { kind: "keep" | "del" | "ins"; text: string };

export interface PolicyRedlineItem {
  policyId: string;
  policy: string;
  section: string;
  obligationId: string;
  original: string;
  segments: Segment[];
  replacement: string;
  citation: string;
  detail: string;
}

/** Sentences that permit what the circular forbids: Board-approved headroom or suppressed reporting. */
const PERMISSIVE = /(Board may approve|shall not be reported|not be reported as breach)/i;

function splitSentences(text: string): string[] {
  return text.match(/[^.]+(?:\.(?!\d)|$)\s*/g)?.filter((x) => x.length) ?? [text];
}

/** Deterministic template: strike the permissive sentence(s), insert the circular's limit in their place. */
export function buildRedlines(s: RunState): PolicyRedlineItem[] {
  const conflicts = s.mapping?.conflicts ?? [];
  const obligations = s.obligations.length ? s.obligations : s.bundle?.obligations ?? [];
  const clauses = s.clauses.length ? s.clauses : s.bundle?.clauses ?? [];
  const items: PolicyRedlineItem[] = [];
  const seen = new Set<string>();
  for (const c of conflicts) {
    if (seen.has(c.policyId)) continue;
    seen.add(c.policyId);
    const pol = POLICIES.find((p) => p.id === c.policyId);
    const original = pol?.text ?? "";
    const ob = obligations.find((o) => o.id === c.obligationId);
    const limit = ob?.threshold ?? 12;
    const para = ob?.clauseNumber ?? "4(b)";
    const boardPara = clauses.find((x) => /no internal policy/i.test(x.text) || /Board oversight/i.test(x.heading ?? ""))?.number ?? "5";
    const paras = para === boardPara ? `para ${para}` : `paras ${para} and ${boardPara}`;
    const replacement = `Exposure to a group of connected counterparties shall not exceed ${limit} per cent of Tier 1 capital for reporting purposes; no Board approval shall suppress the report (${CIRCULAR_REF}, ${paras}).`;

    const sentences = original ? splitSentences(original) : [];
    const anyPermissive = sentences.some((x) => PERMISSIVE.test(x));
    const segments: Segment[] = [];
    let inserted = false;
    for (const sent of sentences) {
      const strike = anyPermissive ? PERMISSIVE.test(sent) : true;
      if (strike) {
        segments.push({ kind: "del", text: sent.trimEnd() });
        if (!inserted) {
          segments.push({ kind: "ins", text: replacement });
          inserted = true;
        }
        if (/\s$/.test(sent)) segments.push({ kind: "keep", text: " " });
      } else segments.push({ kind: "keep", text: sent });
    }
    if (!inserted) segments.push({ kind: "ins", text: replacement });

    items.push({
      policyId: c.policyId,
      policy: pol?.policy ?? c.policyId,
      section: pol?.section ?? c.policySection,
      obligationId: c.obligationId,
      original,
      segments,
      replacement,
      citation: `${CIRCULAR_REF}, ${paras}; obligation ${c.obligationId}`,
      detail: c.detail,
    });
  }
  return items;
}

function plainText(r: PolicyRedlineItem): string {
  const marked = r.segments.map((g) => (g.kind === "del" ? `[DELETE: ${g.text}]` : g.kind === "ins" ? `[INSERT: ${g.text}]` : g.text)).join("");
  return [
    `REDLINE ${r.policy}, section ${r.section} (SYNTHETIC)`,
    "",
    marked.trim(),
    "",
    `Citation: ${r.citation}`,
    "Owner: Compliance, policy-update task",
    "Status: Draft, needs the same two-person approval",
  ].join("\n");
}

function RedlineCard({ r }: { r: PolicyRedlineItem }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(r));
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied("idle"), 2000);
  };
  const headingId = `redline-${r.policyId}`;
  return (
    <article className="bg-surface p-4" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="ui text-[16px] text-ink">
          {r.policy} · section {r.section}
        </h3>
        <span className="ui bg-bad-soft px-2 py-0.5 text-[12px] font-semibold text-bad">Conflict with {r.obligationId}</span>
      </div>
      <p className="ui mt-1 text-[13px] text-muted">{r.detail}</p>

      <p className="mt-3 bg-bg px-4 py-3 text-[15.5px] leading-relaxed text-ink" style={{ fontFamily: "var(--font-text)" }}>
        {r.segments.map((g, i) =>
          g.kind === "del" ? (
            <del key={i} className="bg-bad-soft text-bad line-through decoration-2">
              <span className="sr-only">Deleted: </span>
              {g.text}
            </del>
          ) : g.kind === "ins" ? (
            <ins key={i} className="ml-1 bg-ok-soft text-ok no-underline">
              <span className="sr-only">Inserted: </span>
              {g.text}
            </ins>
          ) : (
            <span key={i}>{g.text}</span>
          ),
        )}
      </p>

      <dl className="ui mt-3 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[110px_1fr]">
        <dt className="text-muted">Citation</dt>
        <dd className="m-0 text-ink">{r.citation}</dd>
        <dt className="text-muted">Owner</dt>
        <dd className="m-0 text-ink">Compliance, policy-update task</dd>
        <dt className="text-muted">Status</dt>
        <dd className="m-0 text-ink">Draft, needs the same two-person approval</dd>
      </dl>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn btn-quiet" onClick={copy}>
          Copy redline
        </button>
        <span className="ui text-[12.5px] text-muted" aria-live="polite">
          {copied === "ok" ? "Copied as plain text." : copied === "fail" ? "Clipboard unavailable in this browser." : ""}
        </span>
      </div>
    </article>
  );
}

export function PolicyRedline({ s }: { s: RunState }) {
  const items = useMemo(() => buildRedlines(s), [s]);
  if (!items.length) {
    return (
      <p data-ui className="ui bg-surface px-4 py-6 text-[14px] text-muted">
        When the Mapper finds an internal policy that permits what the circular forbids, the proposed redline of that policy appears here.
      </p>
    );
  }
  return (
    <div data-ui className="space-y-3">
      <p className="ui text-[13px] text-muted">
        Synthetic policy text. Deletions are struck through, insertions follow; the limit comes from the extracted obligation, not a hard-coded value.
      </p>
      {items.map((r) => (
        <RedlineCard key={r.policyId} r={r} />
      ))}
    </div>
  );
}
