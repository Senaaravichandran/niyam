import type { Database } from "sql.js";
import { compileRule } from "../dsl/compile";
import { parseRule } from "../dsl/schema";
import { EXISTING_RULES } from "../data/seed";
import { DRAFT_BRANCH, type NiyamContext } from "../context";
import type { AgentTools } from "../mcp/client";
import { DRIFT_FROM_DAY, FORWARD_DAYS, getForwardDb, runQuery } from "../sql/engine";
import type { AlertRecord, ApprovalView, ReleaseBundle, RolloutDay } from "../events";
import type { ApprovalPayload } from "../approvals/token";

/**
 * Release: approvals, rollout and rollback. No LLM.
 * Days 1-3 shadow (new rule logs only), days 4-7 canary (10% of subjects behind a flag),
 * days 8-12 live. The Sentinel compares each day's alert count for the new version with the
 * backtest forecast band and rolls back on a breach.
 */

export const CANARY_PCT = 10;
const PHASE = (day: number): RolloutDay["phase"] => (day <= 3 ? "shadow" : day <= 7 ? "canary" : "live");

/** FNV-1a: stable bucket for canary membership. */
export function bucket(subject: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < subject.length; i++) {
    h ^= subject.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}

function alertId(ruleId: string, version: number, day: string, subject: string) {
  return `ALR-${ruleId.replace("SYN-", "").replace("-", "")}V${version}-${day.replace(/-/g, "").slice(2)}-${subject.replace(/^GRP-|^BRW-/, "")}`;
}

function byDay(db: Database, sql: string) {
  const rows = runQuery(db, sql);
  const m = new Map<string, typeof rows>();
  for (const r of rows) m.set(r.as_of, [...(m.get(r.as_of) ?? []), r]);
  return m;
}

export interface ReleaseInput {
  bundle: ReleaseBundle;
  tokens: Record<string, string[]>;
  injectDrift: boolean;
}

export async function runReleaseAgent(ctx: NiyamContext, tools: AgentTools, input: ReleaseInput) {
  const { bundle, tokens, injectDrift } = input;
  const approvals: ApprovalView[] = [];

  // 1. Verify two-person approvals against the exact files.
  for (const d of bundle.drafts) {
    const v = await tools.call<{ ok: boolean; reason?: string; results: { ok: boolean; payload?: ApprovalPayload; reason?: string }[] }>(
      "appr_verify",
      { rule_id: d.ruleId, yaml: d.yaml, tokens: tokens[d.ruleId] ?? [], run_id: bundle.runId },
    );
    (tokens[d.ruleId] ?? []).forEach((t, i) => {
      const p = v.results[i]?.payload;
      if (p) approvals.push({ ruleId: d.ruleId, token: t, payload: p });
    });
    if (!v.ok) {
      ctx.emit({ type: "approvals_verified", ok: false, reason: `${d.ruleId}: ${v.reason}`, approvals });
      return { ok: false as const, reason: `${d.ruleId}: ${v.reason}`, approvals };
    }
  }
  ctx.emit({ type: "approvals_verified", ok: true, approvals });

  // 2. Promote the approved draft branch to main.
  const rules = bundle.drafts.map((d) => ({ rule_id: d.ruleId, yaml: d.yaml, tokens: tokens[d.ruleId] }));
  const promoted = await tools.call<{ short: string; branch: string }>("deploy_promote", {
    branch: DRAFT_BRANCH(ctx.circular.ref),
    rules,
  });
  ctx.emit({ type: "promote", commit: promoted.short, branch: "main" });

  // 3. Roll out day by day under Sentinel watch.
  const db = await getForwardDb(injectDrift);
  const dates = (db.exec("SELECT as_of FROM capital ORDER BY as_of")[0]?.values ?? []).map((v) => String(v[0]));
  const v2 = bundle.drafts.map((d) => ({ draft: d, rule: parseRule(d.yaml), byDay: byDay(db, compileRule(parseRule(d.yaml)).sql) }));
  const v1ByRule = new Map(
    EXISTING_RULES.map((r) => [r.rule_id, byDay(db, compileRule(r).sql)]),
  );
  const forecast = new Map(bundle.impact.rules.map((r) => [r.ruleId, r]));
  const alerts: AlertRecord[] = [];
  const rolledBack = new Set<string>();
  const commits: Record<string, string> = { seed: ctx.seedCommit.short };
  for (const d of bundle.drafts) commits[d.ruleId] = promoted.short;
  let currentPhase: RolloutDay["phase"] | null = null;

  for (let i = 0; i < Math.min(dates.length, FORWARD_DAYS); i++) {
    const dayNo = i + 1;
    const day = dates[i];
    const phase = PHASE(dayNo);
    if (phase !== currentPhase) {
      for (const { draft } of v2) {
        if (rolledBack.has(draft.ruleId)) continue;
        const state = await tools.call("deploy_set_mode", {
          rule_id: draft.ruleId,
          version: draft.version,
          mode: phase,
          canary_pct: CANARY_PCT,
          yaml: draft.yaml,
          tokens: tokens[draft.ruleId],
        });
        ctx.emit({ type: "rollout", state });
      }
      currentPhase = phase;
    }

    const perRule: RolloutDay["perRule"] = {};
    let drifted = false;
    for (const { draft, byDay: rows } of v2) {
      const today = rows.get(day) ?? [];
      if (rolledBack.has(draft.ruleId)) {
        const v1rows = v1ByRule.get(draft.ruleId)?.get(day) ?? [];
        for (const r of v1rows) alerts.push({ id: alertId(draft.ruleId, 1, day, r.subject_id), ruleId: draft.ruleId, version: 1, day, subject: r.subject_id, metricValue: r.metric_value, mode: "v1" });
        perRule[draft.ruleId] = { observed: v1rows.length, band: [0, 0], z: 0, drift: false, mode: "rolled_back (v1)" };
        continue;
      }
      const f = forecast.get(draft.ruleId);
      if (!f) throw new Error(`No backtest forecast for ${draft.ruleId}`);
      const check = await tools.call<{ band: [number, number]; z: number; drift: boolean }>("deploy_sentinel_check", {
        rule_id: draft.ruleId,
        observed: today.length,
        forecast_mean: f.forecastMean,
        forecast_sd: f.forecastSd,
        k: 3,
      });
      perRule[draft.ruleId] = { observed: today.length, band: check.band, z: check.z, drift: check.drift, mode: phase };
      for (const r of today) {
        const inCanary = bucket(r.subject_id) < CANARY_PCT;
        if (phase === "canary" && !inCanary) continue;
        alerts.push({ id: alertId(draft.ruleId, draft.version, day, r.subject_id), ruleId: draft.ruleId, version: draft.version, day, subject: r.subject_id, metricValue: r.metric_value, mode: phase });
      }
      if (check.drift) {
        drifted = true;
        const reason = `Sentinel: ${today.length} alerts on ${day} vs forecast band ${check.band[0].toFixed(1)} to ${check.band[1].toFixed(1)} (z = ${check.z.toFixed(1)})`;
        const rb = await tools.call<{ commit: { short: string } }>("deploy_rollback", { rule_id: draft.ruleId, to_version: 1, reason });
        rolledBack.add(draft.ruleId);
        commits[`${draft.ruleId}@rollback`] = rb.commit.short;
        ctx.emit({ type: "rollback", ruleId: draft.ruleId, toVersion: 1, commit: rb.commit.short, reason });
        perRule[draft.ruleId].mode = "rolled_back";
      }
    }
    const dayRec: RolloutDay = { day, index: dayNo, phase, perRule, drifted };
    ctx.emit({ type: "day", day: dayRec });
  }

  ctx.emit({ type: "alerts", alerts });
  return { ok: true as const, approvals, alerts, commits, rolledBack: [...rolledBack], driftFromDay: injectDrift ? DRIFT_FROM_DAY : null };
}
