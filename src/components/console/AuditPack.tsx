"use client";

import { useEffect, useMemo, useState } from "react";
import { CIRCULAR } from "@/niyam/data/circular";
import type { RunState } from "./state";

/* ---------- hashing and canonical JSON ---------- */

const PACK_SCHEMA = "niyam.audit-pack/1";

/** Stable JSON: object keys sorted at every depth, undefined dropped (as JSON.stringify does). */
export function canonicalJson(value: unknown): string {
  const norm = JSON.parse(JSON.stringify(value ?? null)) as unknown;
  const walk = (v: unknown): string => {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(walk).join(",")}]`;
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${walk(o[k])}`)
      .join(",")}}`;
  };
  return walk(norm);
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- the evidence object ---------- */

type Json = Record<string, unknown>;

export interface AuditPackFile extends Json {
  integrity: { algorithm: "SHA-256"; canonicalization: string; pack_sha256: string };
}

const THEMES = [
  { theme: "Audit trail", sections: "circular, clauses, obligations, mapping, rules, objections, promotion, golden_thread" },
  { theme: "Human oversight", sections: "approvals (two-person sign-off bound to the rule file hash), rollbacks to humans" },
  { theme: "Monitoring", sections: "backtest forecast band, rollout timeline, Sentinel drift, alerts" },
];

/** Build the pack body (without integrity block). Pure apart from the SHA-256 calls. */
async function buildPack(s: RunState): Promise<Json> {
  const bundle = s.bundle;
  const runId = s.meta?.runId ?? bundle?.runId ?? "unknown";
  const ruleSources = bundle?.drafts.length
    ? bundle.drafts.map((d) => ({ ruleId: d.ruleId, version: d.version, yaml: d.yaml, obligationId: d.obligationId, kind: d.kind, title: d.title }))
    : s.drafts.map((d) => ({ ruleId: d.ruleId, version: d.version, yaml: d.yaml, obligationId: d.obligationId, kind: d.kind, title: d.ruleId }));

  const rules = await Promise.all(
    ruleSources.map(async (r) => {
      const latest = s.drafts.find((d) => d.ruleId === r.ruleId);
      const history = s.draftHistory.filter((d) => d.ruleId === r.ruleId);
      const yamlSha = await sha256Hex(r.yaml);
      const tests = s.tests[r.ruleId] ?? [];
      const objections = s.objections
        .filter((o) => o.objection.ruleId === r.ruleId)
        .map((o) => ({
          id: o.objection.id,
          round: o.round,
          code: o.objection.code,
          clause: o.objection.clause,
          span: o.objection.span,
          expected: o.objection.expected,
          found: o.objection.found,
          evidence: o.objection.evidence,
          failing_tests: o.objection.failingTests,
        }));
      const impact = bundle?.impact.rules.find((x) => x.ruleId === r.ruleId) ?? s.backtest?.impact.rules.find((x) => x.ruleId === r.ruleId);
      return {
        rule_id: r.ruleId,
        title: r.title,
        version: r.version,
        kind: r.kind,
        obligation_id: r.obligationId,
        final_yaml: r.yaml,
        yaml_sha256: yamlSha,
        compiled_sql: latest?.sql ?? null,
        draft_commit: latest?.commit ?? null,
        drafting_rounds: history.length,
        tests: {
          passed: tests.filter((t) => t.pass).length,
          total: tests.length,
          results: tests.map((t) => ({ id: t.id, name: t.name, given: t.given, expect_fire: t.expectFire, fired: t.fired, pass: t.pass })),
        },
        objections,
        forecast_band: impact
          ? { mean: impact.forecastMean, sd: impact.forecastSd, low: Math.max(0, impact.forecastMean - 3 * impact.forecastSd), high: impact.forecastMean + 3 * impact.forecastSd, rule: "mean +/- 3 sd" }
          : null,
      };
    }),
  );

  const yamlHashByRule = Object.fromEntries(rules.map((r) => [r.rule_id, r.yaml_sha256]));
  const impact = s.backtest?.impact ?? bundle?.impact;
  const clauses = s.clauses.length ? s.clauses : bundle?.clauses ?? [];
  const obligations = s.obligations.length ? s.obligations : bundle?.obligations ?? [];
  const mapping = s.mapping ?? bundle?.mapping;

  return {
    schema: PACK_SCHEMA,
    notice:
      "All data in this pack is SYNTHETIC. The circular, bank, policies, borrowers and approvers are fictional and were generated for a demonstration. Nothing here is an RBI document or a real bank record.",
    pack_status: s.status === "released" ? "released" : s.status === "refused" ? "refused" : "pre-release",
    alignment:
      "Sections are organised to be aligned with the RBI FREE-AI themes of audit trail, human oversight and monitoring. This pack does not claim compliance with any framework.",
    free_ai_alignment: THEMES,
    run: {
      run_id: runId,
      path: s.meta?.path ?? bundle?.path ?? null,
      engine: s.meta?.engine ?? null,
      llm_model: s.meta?.llmModel ?? null,
      started_at: s.meta?.startedAt ?? null,
      proposal_ms: s.proposalMs ?? null,
      release_ms: s.releaseMs ?? null,
    },
    circular: {
      ref: CIRCULAR.ref,
      title: CIRCULAR.title,
      issued_on: CIRCULAR.issuedOn,
      issuer: CIRCULAR.issuer,
      amends: CIRCULAR.amends,
      synthetic: true,
      text_sha256: await sha256Hex(CIRCULAR.text),
      effective_from: s.effectiveFrom ?? null,
    },
    clauses: clauses
      .filter((c) => c.applicability === "applies")
      .map((c) => ({ id: c.id, number: c.number, heading: c.heading ?? null, applicability: c.applicability, reason: c.reason, scope: c.scope, text: c.text })),
    clauses_not_applied: clauses
      .filter((c) => c.applicability !== "applies")
      .map((c) => ({ id: c.id, number: c.number, applicability: c.applicability, reason: c.reason })),
    obligations: obligations.map((o) => ({
      id: o.id,
      clause_id: o.clauseId,
      clause_number: o.clauseNumber,
      kind: o.kind,
      modality: o.modality,
      actor: o.actor,
      metric: o.metric ?? null,
      operator: o.operator ?? null,
      threshold: o.threshold ?? null,
      unit: o.unit ?? null,
      action: o.action,
      effective_from: o.effectiveFrom,
      scope: o.scope,
      span: o.span,
      span_start: o.spanStart,
      span_end: o.spanEnd,
      extracted_by: o.extractedBy,
    })),
    obligations_rejected: s.rejected.map((r) => ({ clause_number: r.clauseNumber, span: r.span, reason: r.reason })),
    mapping: mapping
      ? {
          modify: mapping.modify.map((m) => ({ rule_id: m.ruleId, obligation_id: m.obligationId, change: m.change })),
          gaps: mapping.gaps.map((g) => ({ obligation_id: g.obligationId, proposed_rule_id: g.proposedRuleId, reason: g.reason })),
          conflicts: mapping.conflicts.map((c) => ({ policy_id: c.policyId, policy_section: c.policySection, obligation_id: c.obligationId, detail: c.detail, resolution: c.resolution })),
          manual_controls: mapping.manualControls.map((m) => ({ obligation_id: m.obligationId, control: m.control })),
        }
      : null,
    rules,
    tests_total: s.testsTotal ?? (bundle ? { passed: bundle.testsPassed, total: bundle.testsTotal } : null),
    backtest: impact
      ? {
          days: impact.days,
          old_alerts: impact.oldAlerts,
          new_alerts: impact.newAlerts,
          delta_pct: impact.deltaPct,
          analyst_hours: impact.analystHours,
          minutes_per_alert: impact.minutesPerAlert,
          newly_flagged_subjects: impact.newlyFlaggedSubjects,
          board_items: impact.boardItems,
          per_rule: impact.rules.map((r) => ({
            rule_id: r.ruleId,
            old_alerts: r.oldAlerts,
            new_alerts: r.newAlerts,
            old_subjects: r.oldSubjects,
            new_subjects: r.newSubjects,
            forecast_mean: r.forecastMean,
            forecast_sd: r.forecastSd,
          })),
        }
      : null,
    approvals: s.approvals.map((a) => ({
      rule_id: a.ruleId,
      version: a.payload.version,
      approver_id: a.payload.approver_id,
      approver_name: a.payload.approver_name,
      role: a.payload.role,
      rule_sha256: a.payload.rule_sha256,
      matches_final_yaml: yamlHashByRule[a.ruleId] ? yamlHashByRule[a.ruleId] === a.payload.rule_sha256 : null,
      issued_at: a.payload.issued_at,
      token_tail: a.token.slice(-12),
    })),
    approval_verification: s.verify ? { ok: s.verify.ok, reason: s.verify.reason ?? null } : null,
    promotion: s.promote ? { commit: s.promote.commit } : null,
    rollout: {
      final_state: Object.values(s.rollout).map((r) => ({ rule_id: r.ruleId, version: r.version, mode: r.mode, canary_pct: r.canaryPct })),
      timeline: s.days.map((d) => ({
        day: d.day,
        index: d.index,
        phase: d.phase,
        drifted: d.drifted,
        per_rule: Object.keys(d.perRule)
          .sort()
          .map((rid) => {
            const r = d.perRule[rid];
            return { rule_id: rid, observed: r.observed, band_low: r.band[0], band_high: r.band[1], z: r.z, drift: r.drift, mode: r.mode };
          }),
      })),
    },
    rollbacks: s.rollbacks.map((r) => ({ rule_id: r.ruleId, to_version: r.toVersion, reason: r.reason, revert_commit: r.commit })),
    alerts: {
      count: s.alerts.length,
      by_mode: s.alerts.reduce<Record<string, number>>((acc, a) => ((acc[a.mode] = (acc[a.mode] ?? 0) + 1), acc), {}),
    },
    golden_thread: s.thread
      ? {
          alert: s.thread.alert,
          rule: { rule_id: s.thread.rule.ruleId, version: s.thread.rule.version, title: s.thread.rule.title, commit: s.thread.rule.commit ?? null },
          approvals: s.thread.approvals.map((a) => ({ approver_name: a.approver_name, role: a.role, rule_sha256: a.rule_sha256, issued_at: a.issued_at })),
          obligation_id: s.thread.obligation?.id ?? null,
          clause: s.thread.clause ?? null,
          circular: s.thread.circular,
          backtest: s.thread.backtest ?? null,
        }
      : null,
  };
}

async function sealPack(body: Json): Promise<AuditPackFile> {
  const pack_sha256 = await sha256Hex(canonicalJson(body));
  return { ...body, integrity: { algorithm: "SHA-256", canonicalization: "JSON, object keys sorted, no whitespace, integrity block excluded", pack_sha256 } };
}

/** Recompute the hash of a downloaded pack. Returns the stated and recomputed hashes. */
export async function verifyPackText(text: string): Promise<{ ok: boolean; stated: string | null; computed: string; runId: string | null }> {
  const parsed = JSON.parse(text) as Json;
  const integrity = parsed.integrity as { pack_sha256?: unknown } | undefined;
  const stated = integrity && typeof integrity.pack_sha256 === "string" ? integrity.pack_sha256 : null;
  const rest: Json = { ...parsed };
  delete rest.integrity;
  const computed = await sha256Hex(canonicalJson(rest));
  const run = rest.run as { run_id?: unknown } | undefined;
  return { ok: stated !== null && stated === computed, stated, computed, runId: run && typeof run.run_id === "string" ? run.run_id : null };
}

/* ---------- printable HTML ---------- */

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function table(head: string[], rows: unknown[][]): string {
  if (!rows.length) return `<p class="muted">None recorded.</p>`;
  return `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

type AnyRec = Record<string, unknown>;
const arr = (v: unknown) => (Array.isArray(v) ? (v as AnyRec[]) : []);

export function printableHtml(p: AuditPackFile): string {
  const hash = p.integrity.pack_sha256;
  const run = (p.run ?? {}) as AnyRec;
  const circ = (p.circular ?? {}) as AnyRec;
  const mapping = (p.mapping ?? null) as AnyRec | null;
  const bt = (p.backtest ?? null) as AnyRec | null;
  const rollout = (p.rollout ?? {}) as AnyRec;
  const thread = (p.golden_thread ?? null) as AnyRec | null;
  const alerts = (p.alerts ?? {}) as AnyRec;

  const rulesHtml = arr(p.rules)
    .map((r) => {
      const tests = (r.tests ?? {}) as AnyRec;
      const band = r.forecast_band as AnyRec | null;
      return `<section class="rule">
<h3>${esc(r.rule_id)} v${esc(r.version)}: ${esc(r.title)}</h3>
<p><b>Kind</b> ${esc(r.kind)} &middot; <b>Obligation</b> ${esc(r.obligation_id)} &middot; <b>Drafting rounds</b> ${esc(r.drafting_rounds)}</p>
<p><b>YAML SHA-256</b> <code>${esc(r.yaml_sha256)}</code></p>
<h4>Final YAML</h4><pre>${esc(r.final_yaml)}</pre>
<h4>Compiled SQL</h4>${r.compiled_sql ? `<pre>${esc(r.compiled_sql)}</pre>` : `<p class="muted">Not recorded.</p>`}
<h4>Generated tests: ${esc(tests.passed)} / ${esc(tests.total)} pass</h4>
${table(["Test", "Given", "Expect fire", "Fired", "Result"], arr(tests.results).map((t) => [t.name, t.given, t.expect_fire ? "yes" : "no", t.fired ? "yes" : "no", t.pass ? "pass" : "FAIL"]))}
<h4>Objection log</h4>
${table(["Round", "Code", "Expected", "Found", "Evidence"], arr(r.objections).map((o) => [o.round, o.code, o.expected, o.found, o.evidence]))}
${band ? `<p><b>Forecast band</b> ${esc(Number(band.low).toFixed(2))} to ${esc(Number(band.high).toFixed(2))} alerts/day (mean ${esc(Number(band.mean).toFixed(2))}, sd ${esc(Number(band.sd).toFixed(2))}, mean &plusmn; 3 sd)</p>` : ""}
</section>`;
    })
    .join("");

  const timelineRows: unknown[][] = [];
  for (const d of arr(rollout.timeline)) for (const r of arr(d.per_rule)) timelineRows.push([d.index, d.day, d.phase, r.rule_id, r.observed, `${Number(r.band_low).toFixed(1)} to ${Number(r.band_high).toFixed(1)}`, r.mode, r.drift ? "DRIFT" : ""]);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NIYAM audit pack ${esc(run.run_id)}</title>
<style>
  :root { --ink:#0b1f3a; --muted:#45546b; --line:#e6ebf2; --surface:#f2f5f9; --ok:#047857; --bad:#b91c1c; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; color: var(--ink); font: 14px/1.5 Georgia, "Source Serif 4", serif; }
  main { max-width: 960px; margin: 0 auto; padding: 32px 24px 48px; }
  h1, h2, h3, h4, th, .ui, button { font-family: "Libre Franklin", system-ui, sans-serif; color: var(--ink); }
  h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 19px; margin: 32px 0 8px; border-bottom: 2px solid var(--ink); padding-bottom: 4px; }
  h3 { font-size: 16px; margin: 20px 0 6px; } h4 { font-size: 13px; margin: 14px 0 4px; text-transform: uppercase; letter-spacing: .04em; }
  p { margin: 4px 0; } .muted { color: var(--muted); }
  code, pre { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
  pre { background: var(--surface); padding: 10px 12px; white-space: pre-wrap; word-break: break-word; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 12.5px; }
  th, td { text-align: left; vertical-align: top; padding: 5px 8px; border: 1px solid var(--line); word-break: break-word; }
  th { background: var(--surface); font-size: 12px; }
  .hash { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; word-break: break-all; }
  header, footer { border: 1px solid var(--line); padding: 10px 12px; margin: 12px 0; }
  .notice { border-left: 4px solid var(--bad); background: #fbe5e5; padding: 8px 12px; margin: 12px 0; }
  .bar { display: flex; gap: 8px; margin-bottom: 12px; }
  button { font-weight: 600; font-size: 14px; background: #1d4ed8; color: #fff; border: 0; padding: 8px 14px; cursor: pointer; border-radius: 0; }
  .rule { break-inside: avoid-page; }
  @media print { .bar { display: none; } main { padding: 0; } h2 { break-after: avoid; } }
</style></head>
<body><main>
<div class="bar"><button type="button" onclick="window.print()">Print or save as PDF</button></div>
<h1>NIYAM audit pack</h1>
<p class="ui muted">Run ${esc(run.run_id)} &middot; status ${esc(p.pack_status)} &middot; ${esc(circ.ref)}</p>
<header><p class="ui"><b>Pack SHA-256</b></p><p class="hash">${esc(hash)}</p><p class="muted">${esc(p.integrity.canonicalization)}</p></header>
<p class="notice">${esc(p.notice)}</p>
<p>${esc(p.alignment)}</p>
${table(["FREE-AI theme (aligned with)", "Pack sections"], arr(p.free_ai_alignment).map((t) => [t.theme, t.sections]))}

<h2>1. Run</h2>
${table(["Run id", "Path", "Engine", "Model", "Started"], [[run.run_id, run.path, run.engine, run.llm_model ?? "none", run.started_at]])}

<h2>2. Circular</h2>
<p><b>${esc(circ.ref)}</b> ${esc(circ.title)}</p>
<p>Issued ${esc(circ.issued_on)} by ${esc(circ.issuer)}. Amends ${esc(circ.amends)}. Effective from ${esc(circ.effective_from ?? "n/a")}.</p>
<p><b>Text SHA-256</b> <span class="hash">${esc(circ.text_sha256)}</span></p>

<h2>3. Applicable clauses</h2>
${table(["Para", "Applicability", "Reason", "Text"], arr(p.clauses).map((c) => [c.number, c.applicability, c.reason, c.text]))}
<h4>Not applied</h4>
${table(["Para", "Applicability", "Reason"], arr(p.clauses_not_applied).map((c) => [c.number, c.applicability, c.reason]))}

<h2>4. Obligations</h2>
${table(["Id", "Para", "Modality", "Condition", "Span", "Offsets", "By"], arr(p.obligations).map((o) => [o.id, o.clause_number, o.modality, o.metric ? `${o.metric} ${o.operator} ${o.threshold}` : o.action, o.span, `${o.span_start}-${o.span_end}`, o.extracted_by]))}

<h2>5. Mapping</h2>
${
  mapping
    ? `<h4>Modify</h4>${table(["Rule", "Obligation", "Change"], arr(mapping.modify).map((m) => [m.rule_id, m.obligation_id, m.change]))}
<h4>Gaps</h4>${table(["Proposed rule", "Obligation", "Reason"], arr(mapping.gaps).map((g) => [g.proposed_rule_id, g.obligation_id, g.reason]))}
<h4>Policy conflicts</h4>${table(["Policy", "Section", "Obligation", "Detail", "Resolution"], arr(mapping.conflicts).map((c) => [c.policy_id, c.policy_section, c.obligation_id, c.detail, c.resolution]))}
<h4>Manual controls</h4>${table(["Obligation", "Control"], arr(mapping.manual_controls).map((m) => [m.obligation_id, m.control]))}`
    : `<p class="muted">Not recorded.</p>`
}

<h2>6. Rules</h2>
${rulesHtml || `<p class="muted">No rules drafted.</p>`}

<h2>7. Backtest</h2>
${
  bt
    ? `<p>${esc(bt.old_alerts)} &rarr; ${esc(bt.new_alerts)} alerts over ${esc(bt.days)} synthetic days (${esc(bt.delta_pct)}%). ${esc(bt.analyst_hours)} analyst hours, ${esc(bt.newly_flagged_subjects)} newly flagged subjects, ${esc(bt.board_items)} board items.</p>
${table(["Rule", "Old alerts", "New alerts", "Forecast mean", "Forecast sd"], arr(bt.per_rule).map((r) => [r.rule_id, r.old_alerts, r.new_alerts, Number(r.forecast_mean).toFixed(2), Number(r.forecast_sd).toFixed(2)]))}`
    : `<p class="muted">Not recorded.</p>`
}

<h2>8. Two-person approval</h2>
${table(["Rule", "Approver", "Role", "Signed file SHA-256", "Matches final YAML", "Issued at", "Token tail"], arr(p.approvals).map((a) => [`${a.rule_id} v${a.version}`, a.approver_name, a.role, a.rule_sha256, a.matches_final_yaml === null ? "n/a" : a.matches_final_yaml ? "yes" : "NO", a.issued_at, a.token_tail]))}
${p.approval_verification ? `<p><b>Server verification</b> ${(p.approval_verification as AnyRec).ok ? "accepted" : `refused: ${esc((p.approval_verification as AnyRec).reason)}`}</p>` : ""}

<h2>9. Promotion and rollout</h2>
<p><b>Promotion commit</b> ${p.promotion ? `<code>${esc((p.promotion as AnyRec).commit)}</code>` : "none"}</p>
${table(["Rule", "Version", "Final mode", "Canary %"], arr(rollout.final_state).map((r) => [r.rule_id, r.version, r.mode, r.canary_pct]))}
<h4>Timeline</h4>
${table(["Day", "Date", "Phase", "Rule", "Observed", "Band", "Mode", "Drift"], timelineRows)}
<h4>Rollbacks</h4>
${table(["Rule", "To version", "Reason", "Revert commit"], arr(p.rollbacks).map((r) => [r.rule_id, r.to_version, r.reason, r.revert_commit]))}
<p><b>Alerts raised</b> ${esc(alerts.count)}</p>

<h2>10. Golden Thread</h2>
${
  thread
    ? (() => {
        const a = (thread.alert ?? {}) as AnyRec;
        const r = (thread.rule ?? {}) as AnyRec;
        const c = (thread.clause ?? null) as AnyRec | null;
        const ci = (thread.circular ?? {}) as AnyRec;
        return table(
          ["Link", "Record"],
          [
            ["Alert", `${a.id} ${a.subject} at ${Number(a.metricValue).toFixed(2)}% on ${a.day} (${a.mode})`],
            ["Rule", `${r.rule_id} v${r.version} ${r.title}${r.commit ? ` commit ${r.commit}` : ""}`],
            ["Approvals", arr(thread.approvals).map((x) => `${x.approver_name} (${x.role}) sha256 ${String(x.rule_sha256).slice(0, 16)}`).join("; ") || "none"],
            ["Obligation", thread.obligation_id ?? "n/a"],
            ["Clause", c ? `para ${c.number}: ${c.span} [${c.start}-${c.end}]` : "n/a"],
            ["Circular", `${ci.ref} ${ci.title}`],
          ],
        );
      })()
    : `<p class="muted">Not recorded.</p>`
}

<footer><p class="ui"><b>Pack SHA-256</b> <span class="hash">${esc(hash)}</span></p><p class="muted">Recompute with the Verify control in the NIYAM console. ${esc(p.notice)}</p></footer>
</main></body></html>`;
}

/* ---------- UI ---------- */

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="bg-surface px-3 py-2">
      <dt className="text-[12px] text-muted">{k}</dt>
      <dd className="num m-0 text-[15px] font-semibold text-ink">{v}</dd>
    </div>
  );
}

export function AuditPack({ s }: { s: RunState }) {
  const ready = s.status === "released" || s.status === "refused" || !!s.bundle;
  const [pack, setPack] = useState<AuditPackFile | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; stated: string | null; computed: string; runId: string | null; name: string } | { error: string; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Rebuild whenever the run state changes; hashing is async.
  useEffect(() => {
    if (!ready) {
      setPack(null);
      return;
    }
    let live = true;
    buildPack(s)
      .then(sealPack)
      .then((p) => {
        if (live) setPack(p);
      })
      .catch((e: unknown) => {
        if (live) setNotice(`Could not build the pack: ${e instanceof Error ? e.message : String(e)}`);
      });
    return () => {
      live = false;
    };
  }, [s, ready]);

  const runId = useMemo(() => {
    const r = pack?.run as { run_id?: string } | undefined;
    return r?.run_id ?? "run";
  }, [pack]);

  if (!ready) {
    return (
      <p data-ui className="ui bg-surface px-4 py-6 text-[14px] text-muted">
        The audit pack assembles once the approval bundle exists: every rule, hash, approval, rollout day and rollback in one tamper-evident file.
      </p>
    );
  }

  const download = () => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `niyam-audit-${runId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openPrintable = () => {
    if (!pack) return;
    const w = window.open("", "_blank");
    if (!w) {
      setNotice("The browser blocked the new window. Allow pop-ups for this page and try again.");
      return;
    }
    w.document.open();
    w.document.write(printableHtml(pack));
    w.document.close();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const r = await verifyPackText(await f.text());
      setVerifyResult({ ...r, name: f.name });
    } catch (err) {
      setVerifyResult({ error: err instanceof Error ? err.message : String(err), name: f.name });
    }
  };

  const p = pack as (AuditPackFile & { rules?: unknown[]; approvals?: unknown[]; rollout?: { timeline?: unknown[] }; rollbacks?: unknown[]; obligations?: unknown[]; clauses?: unknown[]; alerts?: { count?: number }; pack_status?: string }) | null;

  return (
    <div data-ui className="ui space-y-4" aria-busy={!pack}>
      <p className="bg-surface-2 px-3 py-2 text-[13px] text-ink">
        <b>Synthetic data.</b> The circular, bank, approvers and borrowers are fictional; this pack is a demonstration of evidence, not an RBI submission.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className={`px-2 py-0.5 font-semibold ${p?.pack_status === "released" ? "bg-ok-soft text-ok" : p?.pack_status === "refused" ? "bg-bad-soft text-bad" : "bg-surface text-muted"}`}>
          {p?.pack_status === "pre-release" ? "Pre-release pack" : p?.pack_status === "refused" ? "Refused release pack" : p ? "Released pack" : "Building"}
        </span>
        <span className="text-muted">Run {runId}</span>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat k="Applicable clauses" v={p?.clauses?.length ?? "…"} />
        <Stat k="Obligations" v={p?.obligations?.length ?? "…"} />
        <Stat k="Rules with YAML hash" v={p?.rules?.length ?? "…"} />
        <Stat k="Approvals" v={p?.approvals?.length ?? "…"} />
        <Stat k="Rollout days" v={p?.rollout?.timeline?.length ?? "…"} />
        <Stat k="Rollbacks" v={p?.rollbacks?.length ?? "…"} />
        <Stat k="Alerts" v={p?.alerts?.count ?? "…"} />
        <Stat k="Golden Thread" v={p ? (p.golden_thread ? "included" : "none yet") : "…"} />
      </dl>

      <div className="bg-surface px-3 py-2.5">
        <p className="text-[12px] text-muted">Pack SHA-256 (canonical JSON, keys sorted, integrity block excluded)</p>
        <p className="code m-0 break-all text-[12.5px] text-ink" aria-live="polite">
          {pack ? pack.integrity.pack_sha256 : "Computing…"}
        </p>
      </div>

      <ul className="m-0 list-none space-y-1 p-0 text-[13px] text-ink">
        <li>
          <b>Audit trail</b> <span className="text-muted">(aligned with FREE-AI): circular hash, clause spans and offsets, rule YAML hashes, objection log, commits, Golden Thread.</span>
        </li>
        <li>
          <b>Human oversight</b> <span className="text-muted">(aligned with FREE-AI): two named approvers per rule, each signature bound to the rule file hash.</span>
        </li>
        <li>
          <b>Monitoring</b> <span className="text-muted">(aligned with FREE-AI): backtest forecast band, daily rollout against the band, drift rollbacks and alerts.</span>
        </li>
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={download} disabled={!pack}>
          Download JSON
        </button>
        <button type="button" className="btn btn-quiet" onClick={openPrintable} disabled={!pack}>
          Open printable pack
        </button>
      </div>
      {notice && (
        <p role="alert" className="bg-bad-soft px-3 py-2 text-[13px] text-bad">
          {notice}
        </p>
      )}

      <div className="bg-surface p-3">
        <label htmlFor="audit-verify" className="block text-[13px] font-semibold text-ink">
          Verify a pack
        </label>
        <p className="mb-2 text-[12.5px] text-muted">Load a downloaded pack. NIYAM recomputes the hash; any edited byte of content changes it.</p>
        <input id="audit-verify" type="file" accept="application/json,.json" onChange={onFile} className="block text-[13px] text-ink file:mr-3 file:cursor-pointer file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:font-semibold file:text-ink" />
        <div aria-live="polite">
          {verifyResult &&
            ("error" in verifyResult ? (
              <p className="mt-2 bg-bad-soft px-3 py-2 text-[13px] text-bad">
                {verifyResult.name}: not a readable pack ({verifyResult.error}).
              </p>
            ) : (
              <div className={`mt-2 px-3 py-2 text-[13px] ${verifyResult.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                <p className="font-semibold">
                  {verifyResult.ok ? "Match. The pack is unchanged since it was sealed." : verifyResult.stated ? "Mismatch. The pack was altered after it was sealed." : "No integrity block found in this file."}
                </p>
                <p className="code m-0 break-all text-[11.5px] text-ink">stated&nbsp;&nbsp;&nbsp;{verifyResult.stated ?? "none"}</p>
                <p className="code m-0 break-all text-[11.5px] text-ink">computed {verifyResult.computed}</p>
                {verifyResult.runId && <p className="text-[12px] text-muted">{verifyResult.name} · run {verifyResult.runId}</p>}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
