"use client";

import { useState } from "react";
import type { RunState } from "./state";

/** Mirrors APPROVERS and REVIEW_CHECKS on the server (src/niyam/approvals/token.ts). */
const APPROVERS = [
  { id: "APR-CCO", name: "A. Menon", role: "Chief Compliance Officer", duty: "Maker", empId: "CCO-0142", does: "Reviews and prepares the change: clause, rule, tests and impact." },
  { id: "APR-RISK", name: "R. Iyer", role: "Head of Risk and IT Change", duty: "Checker", empId: "RSK-0217", does: "Independently checks and authorises the change for release." },
] as const;

const CHECKS = [
  ["clause: I read the circular clause and the exact quoted words", "I read each clause and its exact quoted words"],
  ["rule: The rule's number, operator and scope match the clause", "Each rule's number, operator and scope match its clause"],
  ["tests: All generated tests pass, including the boundary cases", "All generated tests pass, boundary cases included"],
  ["impact: I reviewed the 90-day backtest and the alert impact", "I reviewed the 90-day backtest and alert impact"],
] as const;

export interface ReviewInput {
  name: string;
  employeeId: string;
  reason: string;
  checks: string[];
}

function ApproverCard({
  a,
  s,
  onSign,
  signing,
  locked,
  otherName,
}: {
  a: (typeof APPROVERS)[number];
  s: RunState;
  onSign: (id: string, review: ReviewInput) => void;
  signing: string | null;
  locked: boolean;
  otherName?: string;
}) {
  const bundle = s.bundle!;
  const [name, setName] = useState<string>(a.name);
  const [emp, setEmp] = useState<string>(a.empId);
  const [reason, setReason] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const toks = s.approvals.filter((t) => t.payload.approver_id === a.id);
  const done = toks.length === bundle.drafts.length;
  const sameName = !!otherName && otherName.trim().toLowerCase() === name.trim().toLowerCase();
  const ready = name.trim().length >= 2 && /^[A-Za-z0-9-]{3,20}$/.test(emp) && reason.trim().length >= 10 && checks.length === CHECKS.length && !sameName;
  const suggested = `${bundle.drafts.map((d) => d.ruleId).join(", ")} match the circular's clauses; ${bundle.testsPassed}/${bundle.testsTotal} tests pass; backtest impact (${bundle.impact.oldAlerts} to ${bundle.impact.newAlerts} alerts over ${bundle.impact.days} days) reviewed and accepted.`;

  if (done) {
    const p = toks[0].payload;
    return (
      <div className="bg-ok-soft p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ui text-[12px] font-semibold uppercase tracking-[0.06em] text-ok">{a.duty} · signed</p>
            <p className="text-[16px] font-semibold text-ink">{p.approver_name}</p>
            <p className="text-[13px] text-muted">
              {p.role} · {p.employee_id ?? a.empId} · {new Date(p.issued_at).toLocaleString()}
            </p>
          </div>
        </div>
        {p.reason && <p className="mt-2 text-[14px] text-ink">“{p.reason}”</p>}
        <p className="ui mt-3 text-[12px] font-semibold text-muted">Signed approval tokens</p>
        {toks.map((t) => (
          <p key={t.ruleId} className="code mt-1 truncate text-[11.5px] text-ink" title={t.token}>
            {t.ruleId} v{t.payload.version} · file sha256 {t.payload.rule_sha256.slice(0, 12)}… · sig …{t.token.slice(-16)}
          </p>
        ))}
      </div>
    );
  }

  return (
    <form
      className="bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSign(a.id, { name: name.trim(), employeeId: emp.trim(), reason: reason.trim(), checks: CHECKS.map(([k]) => k) });
      }}
    >
      <p className="ui text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">{a.duty}</p>
      <p className="text-[16px] font-semibold text-ink">{a.role}</p>
      <p className="text-[13px] text-muted">{a.does}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px]">
        <label className="text-[12.5px] text-muted">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={locked} maxLength={60} className="mt-1 block w-full bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:bg-white" />
        </label>
        <label className="text-[12.5px] text-muted">
          Employee ID
          <input value={emp} onChange={(e) => setEmp(e.target.value)} disabled={locked} maxLength={20} className="code mt-1 block w-full bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:bg-white" />
        </label>
      </div>
      {sameName && <p className="mt-1 text-[12.5px] text-bad">Maker and checker must be two different people.</p>}
      <label className="mt-2 block text-[12.5px] text-muted">
        Reason for approving
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} disabled={locked} maxLength={500} rows={3} placeholder="Why is this change correct and safe to release?" className="mt-1 block w-full resize-y bg-bg px-3 py-2 text-[14px] leading-snug text-ink outline-none focus:bg-white" />
      </label>
      {!reason && !locked && (
        <button type="button" onClick={() => setReason(suggested)} className="ui mt-1 cursor-pointer text-[12.5px] text-accent underline">
          Use a suggested reason
        </button>
      )}
      <fieldset className="m-0 mt-3 border-0 p-0">
        <legend className="text-[12.5px] text-muted">I confirm that</legend>
        {CHECKS.map(([key, label]) => (
          <label key={key} className="mt-1.5 flex cursor-pointer items-start gap-2 text-[13.5px] text-ink">
            <input type="checkbox" disabled={locked} checked={checks.includes(key)} onChange={(e) => setChecks(e.target.checked ? [...checks, key] : checks.filter((c) => c !== key))} className="mt-0.5 h-4 w-4 accent-[#1d4ed8]" />
            {label}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="btn mt-4 !px-4 !py-2 !text-[14px]" disabled={!ready || locked || signing !== null}>
        {signing === a.id ? "Signing…" : `Sign as ${a.duty.toLowerCase()}`}
      </button>
    </form>
  );
}

export function ApprovalForms({
  s,
  bankName,
  onSign,
  signing,
  tamper,
  setTamper,
  drift,
  setDrift,
  onRelease,
}: {
  s: RunState;
  bankName: string;
  onSign: (id: string, review: ReviewInput) => void;
  signing: string | null;
  tamper: boolean;
  setTamper: (v: boolean) => void;
  drift: boolean;
  setDrift: (v: boolean) => void;
  onRelease: () => void;
}) {
  const bundle = s.bundle;
  if (!bundle) return <p className="ui bg-surface px-4 py-6 text-[14px] text-muted">The pipeline stops here and waits for two people. Nothing reaches production without them.</p>;
  if (!bundle.drafts.length) return <p className="ui bg-surface px-4 py-6 text-[14px] text-muted">This circular needs no rule changes for this bank, so there is nothing to sign. The mapping above lists any manual controls for Compliance.</p>;
  const signedName = (id: string) => s.approvals.find((t) => t.payload.approver_id === id)?.payload.approver_name;
  const both = APPROVERS.every((a) => s.approvals.filter((t) => t.payload.approver_id === a.id).length === bundle.drafts.length);
  const releasing = s.status === "releasing";
  const released = s.status === "released" || s.status === "refused";
  return (
    <div data-ui className="space-y-4">
      <div className="bg-surface p-4 text-[14px]">
        <p className="font-semibold text-ink">
          Approval pack {bundle.runId}: {bundle.drafts.length} rule change{bundle.drafts.length > 1 ? "s" : ""} for {bankName}, {bundle.testsPassed}/{bundle.testsTotal} tests pass, {bundle.mapping.conflicts.length} policy conflict{bundle.mapping.conflicts.length === 1 ? "" : "s"} routed to Compliance
        </p>
        <ul className="m-0 mt-2 grid gap-1 p-0 md:grid-cols-2">
          {bundle.drafts.map((d) => (
            <li key={d.ruleId} className="code list-none bg-bg px-2 py-1 text-[12.5px] text-ink">
              {d.ruleId} v{d.version} · {d.kind === "new" ? "new rule" : "amended"} · {d.yaml.match(/op: "([^"]+)"/)?.[1]} {d.yaml.match(/value: ([\d.]+)/)?.[1]}%
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-muted">Each signature is an HMAC-SHA256 token over the rule id, version, the SHA-256 of the exact rule file, and the approver&apos;s name, role, ID, reason and checks. Valid for 24 hours.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {APPROVERS.map((a, i) => (
          <ApproverCard key={a.id} a={a} s={s} onSign={onSign} signing={signing} locked={releasing || released} otherName={signedName(APPROVERS[1 - i].id)} />
        ))}
      </div>
      <fieldset className="m-0 grid gap-2 border-0 p-0 text-[14px] md:grid-cols-2">
        <legend className="sr-only">Release options</legend>
        <label className="flex cursor-pointer items-start gap-3 bg-surface p-3">
          <input type="checkbox" checked={drift} onChange={(e) => setDrift(e.target.checked)} className="mt-1 h-4 w-4 accent-[#1d4ed8]" />
          <span>
            <b className="text-ink">Inject a data fault on rollout day 10</b>
            <span className="block text-[13px] text-muted">The loan feed loads twice. The Sentinel should catch it and roll back.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 bg-surface p-3">
          <input type="checkbox" checked={tamper} onChange={(e) => setTamper(e.target.checked)} className="mt-1 h-4 w-4 accent-[#b91c1c]" />
          <span>
            <b className="text-ink">Tamper test: edit a signed rule before release</b>
            <span className="block text-[13px] text-muted">Raises the first rule&apos;s limit by one in the file sent to Release. Expect a refusal.</span>
          </span>
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={onRelease} disabled={!both || releasing}>
          {releasing ? "Releasing…" : `Release to ${bankName}: shadow, canary, live`}
        </button>
        <span className="text-[13px] text-muted">{both ? `Opens ${bankName}'s rule-engine site and streams the rollout to it live.` : "Both approvers must sign first."}</span>
      </div>
    </div>
  );
}
