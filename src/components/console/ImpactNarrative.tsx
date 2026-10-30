"use client";

import YAML from "yaml";
import { BANK_PROFILE } from "@/niyam/data/bankProfile";
import { EXISTING_RULES } from "@/niyam/data/seed";
import type { RunState } from "./state";

/**
 * Deterministic impact narrative. Every sentence is assembled from fields already in the run state
 * (approval bundle, backtest, mapping, objections, test totals); no language model writes any of it.
 * Each number carries a source tag so a reader can tell where it came from.
 */

type Src = "draft" | "live v1" | "circular" | "backtest" | "mapping" | "validator" | "tests";

function Tag({ src }: { src: Src }) {
  return (
    <span
      className="ui ml-1 inline-block bg-surface px-1 align-[0.15em] text-[10px] font-semibold uppercase leading-[1.5] tracking-[0.04em] text-muted"
      title={`Source: ${src}`}
    >
      <span className="sr-only">(source: </span>
      {src}
      <span className="sr-only">)</span>
    </span>
  );
}

function N({ v, src, tone }: { v: string | number; src: Src; tone?: "bad" | "ok" }) {
  const cls = tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <span className="whitespace-nowrap">
      <span className={`num font-semibold ${cls}`}>{typeof v === "number" ? v.toLocaleString("en-IN") : v}</span>
      <Tag src={src} />
    </span>
  );
}

interface ParsedDraft {
  title?: string;
  when?: { metric?: string; op?: string; value?: number };
  unless?: string;
  source?: { clause?: string };
}

function parse(yaml: string): ParsedDraft {
  try {
    return (YAML.parse(yaml) as ParsedDraft) ?? {};
  } catch {
    return {};
  }
}

const pct = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(1)}%`;

const OP_PHRASE: Record<string, string> = {
  ">": "above",
  ">=": "at or above",
  "<": "below",
  "<=": "at or below",
  "==": "exactly at",
};

/** For "fires above X" rules a lower X catches more; for "fires below X" a higher X does. */
function direction(op: string, from: number, to: number): "tightens" | "loosens" | "keeps" {
  if (from === to) return "keeps";
  const upward = op === ">" || op === ">=";
  return (upward ? to < from : to > from) ? "tightens" : "loosens";
}

function lowerFirst(s: string) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

const bankName = BANK_PROFILE.name.replace(/\s*\(SYNTHETIC\)\s*$/i, "");

export function ImpactNarrative({ s }: { s: RunState }) {
  const b = s.bundle;
  if (!b) {
    return (
      <div data-ui>
        <p className="ui bg-surface px-4 py-6 text-[14px] text-muted">
          The impact summary is written once the approval pack is ready. It is assembled from the backtest, the policy mapping and the test results, not generated.
        </p>
      </div>
    );
  }

  const impact = s.backtest?.impact ?? b.impact;
  const mapping = s.mapping ?? b.mapping;
  const tests = s.testsTotal ?? { passed: b.testsPassed, total: b.testsTotal };
  const finalRound = Math.max(0, ...s.drafts.map((d) => d.round));

  const rules = b.drafts.map((d) => {
    const y = parse(d.yaml);
    const live = EXISTING_RULES.find((r) => r.rule_id === d.ruleId);
    const ob = b.obligations.find((o) => o.id === d.obligationId);
    const clause = ob?.clauseNumber ?? y.source?.clause;
    return { d, y, live, clause };
  });

  const deltaAlerts = impact.newAlerts - impact.oldAlerts;
  const deltaPct = Math.round(impact.deltaPct);
  const objectionCount = s.objections.length;
  /** An objection raised in round r is resolved once that rule's current draft is from a later round. */
  const unresolved = s.objections.filter((o) => !s.drafts.some((d) => d.ruleId === o.objection.ruleId && d.round > o.round));
  const testsTone = tests.total > 0 && tests.passed === tests.total ? "ok" : "bad";

  return (
    <div data-ui className="bg-bg">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="ui bg-surface px-2 py-0.5 text-[12px] font-semibold text-muted">Deterministic summary · no model output</span>
        <span className="ui bg-surface px-2 py-0.5 text-[12px] font-semibold text-muted">SYNTHETIC data</span>
      </div>

      <div className="max-w-[68ch] space-y-3 text-[16px] leading-[1.7] text-ink" style={{ fontFamily: "var(--font-text)" }}>
        <p className="m-0">
          {b.circularRef} changes <N v={b.drafts.length} src="draft" /> {b.drafts.length === 1 ? "rule" : "rules"} for {bankName}.{" "}
          {rules.map(({ d, y, live, clause }) => {
            const title = lowerFirst(y.title ?? d.title);
            const para = clause ? ` (para ${clause})` : "";
            const to = y.when?.value;
            const op = y.when?.op ?? "";
            if (live && typeof to === "number") {
              const from = live.when.value;
              const dir = direction(op || live.when.op, from, to);
              const extra: string[] = [];
              if (op && op !== live.when.op) extra.push(`now fires ${OP_PHRASE[op] ?? op} the limit instead of ${OP_PHRASE[live.when.op] ?? live.when.op} it`);
              if (live.unless && !y.unless) extra.push(`drops the ${live.unless.replace("_", "-")} exemption`);
              return (
                <span key={d.ruleId}>
                  {title.charAt(0).toUpperCase() + title.slice(1)} ({d.ruleId}){" "}
                  {dir === "keeps" ? (
                    <>
                      keeps its <N v={pct(to)} src="draft" /> threshold
                    </>
                  ) : (
                    <>
                      {dir} from <N v={pct(from)} src="live v1" /> to <N v={pct(to)} src="draft" />
                    </>
                  )}
                  {para}

                  {extra.length ? `; it ${extra.join(" and ")}` : ""}.{" "}
                </span>
              );
            }
            return (
              <span key={d.ruleId}>
                A new rule, {title} ({d.ruleId}), fires {OP_PHRASE[op] ?? op}{" "}
                {typeof to === "number" ? <N v={pct(to)} src="draft" /> : "the stated limit"}
                {para}.{" "}
              </span>
            );
          })}
        </p>

        <p className="m-0">
          Over the last <N v={impact.days} src="backtest" /> synthetic days the amended rules would have raised <N v={impact.newAlerts} src="backtest" /> alerts instead of{" "}
          <N v={impact.oldAlerts} src="backtest" />
          {impact.oldAlerts > 0 ? (
            <>
              {" "}
              (<N v={`${deltaPct >= 0 ? "+" : "−"}${Math.abs(deltaPct)}%`} src="backtest" tone={deltaPct > 0 ? "bad" : "ok"} />)
            </>
          ) : null}
          , about <N v={Math.abs(impact.analystHours)} src="backtest" /> {deltaAlerts >= 0 ? "extra" : "fewer"} analyst hours at <N v={impact.minutesPerAlert} src="backtest" /> minutes each
          {impact.newlyFlaggedSubjects > 0 ? (
            <>
              , and <N v={impact.newlyFlaggedSubjects} src="backtest" /> groups or borrowers are flagged for the first time
              {impact.boardItems > 0 && impact.boardItems !== impact.newlyFlaggedSubjects ? (
                <>
                  {" "}
                  (<N v={impact.boardItems} src="backtest" /> board {impact.boardItems === 1 ? "item" : "items"})
                </>
              ) : null}
            </>
          ) : (
            <>, and no group or borrower is flagged for the first time</>
          )}
          .
        </p>

        {(mapping.conflicts.length > 0 || mapping.gaps.length > 0 || mapping.manualControls.length > 0) && (
          <p className="m-0">
            {mapping.conflicts.map((c, i) => {
              // policySection reads "POL-CR-07 Credit Concentration Policy (SYNTHETIC) §7.2"; cite it as "POL-CR-07 §7.2".
              const m = /^(\S+).*§\s*(\S+)$/.exec(c.policySection);
              const policy = m ? `${m[1]} §${m[2]}` : c.policySection || c.policyId;
              return (
                <span key={`${c.policyId}-${i}`}>
                  Internal policy {policy}
                  <Tag src="mapping" /> conflicts with the circular: {c.detail} Resolution: {c.resolution}
                  {/[.!?]$/.test(c.resolution) ? " " : ". "}
                </span>
              );
            })}
            {mapping.gaps.length > 0 && (
              <>
                The Mapper found <N v={mapping.gaps.length} src="mapping" /> {mapping.gaps.length === 1 ? "obligation" : "obligations"} with no existing rule (
                {mapping.gaps.map((g) => g.proposedRuleId).join(", ")}).{" "}
              </>
            )}
            {mapping.manualControls.length > 0 && (
              <>
                <N v={mapping.manualControls.length} src="mapping" /> procedural {mapping.manualControls.length === 1 ? "obligation stays a manual control" : "obligations stay manual controls"}.
              </>
            )}
          </p>
        )}

        <p className="m-0">
          {objectionCount === 0 ? (
            <>The Validator raised no objections.</>
          ) : (
            <>
              The Validator raised <N v={objectionCount} src="validator" /> {objectionCount === 1 ? "objection" : "objections"} (
              {s.objections.map((o) => `${o.objection.code} on ${o.objection.ruleId}`).join("; ")})
              {unresolved.length === 0 ? (
                <>
                  , resolved by round <N v={finalRound} src="validator" />.
                </>
              ) : (
                <>
                  ; <N v={unresolved.length} src="validator" tone="bad" /> still open.
                </>
              )}
            </>
          )}{" "}
          <N v={tests.passed} src="tests" tone={testsTone} /> of <N v={tests.total} src="tests" /> generated tests pass.
        </p>
      </div>
    </div>
  );
}
