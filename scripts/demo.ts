/**
 * npm run demo: the whole NIYAM pipeline in the terminal, offline, on synthetic data.
 * Circular -> clauses -> obligations -> mapping -> drafts -> objection -> tests -> backtest ->
 * two-person approval -> shadow -> canary -> live -> injected drift -> rollback -> Golden Thread.
 */
import { createContext } from "../src/niyam/context";
import { runProposal, runRelease } from "../src/niyam/pipeline";
import { APPROVERS, issueToken, usingDevSecret } from "../src/niyam/approvals/token";
import type { RunEvent } from "../src/niyam/events";
import { formatThread } from "../src/niyam/thread";

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  amber: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

const verbose = process.argv.includes("--verbose");
const path = process.argv.includes("--llm") ? "llm" : "rule-based";

function print(e: RunEvent) {
  switch (e.type) {
    case "meta":
      console.log(C.bold(`\nNIYAM run ${e.runId}`), C.dim(`path=${e.path}${e.llmModel ? ` model=${e.llmModel}` : ""} engine=${e.engine}`));
      if (e.note) console.log(C.amber(`  ${e.note}`));
      break;
    case "step":
      if (e.status === "running") return;
      {
        const tag = e.status === "done" ? C.green("done") : e.status === "warn" ? C.amber("warn") : e.status === "blocked" ? C.blue("wait") : C.red(e.status);
        console.log(`  [${tag}] ${C.bold(e.title)} ${C.dim(`(${e.agent}${e.ms != null ? `, ${e.ms} ms` : ""})`)}\n         ${e.detail ?? ""}`);
      }
      break;
    case "guardrail":
      console.log(C.dim(`         guardrail ${e.layer}: ${e.result}`));
      break;
    case "a2a":
      if (verbose) console.log(C.dim(`         a2a ${e.from} -> ${e.to} ${e.skill} ${e.state}`));
      break;
    case "objection":
      console.log(C.red(`         OBJECTION ${e.objection.id} [${e.objection.code}] round ${e.round}`));
      console.log(C.red(`           expected: ${e.objection.expected}`));
      console.log(C.red(`           found:    ${e.objection.found}`));
      break;
    case "draft":
      if (e.draft.round > 1) console.log(C.green(`         revised ${e.draft.ruleId} -> commit ${e.draft.commit}`));
      break;
    case "tests_total":
      console.log(C.bold(`         tests ${e.passed}/${e.total} pass`));
      break;
    case "backtest":
      console.log(`         backtest: ${e.impact.oldAlerts} -> ${e.impact.newAlerts} alerts over ${e.impact.days} days, +${e.impact.analystHours} analyst hours`);
      for (const r of e.impact.rules) console.log(C.dim(`           ${r.ruleId}: ${r.oldAlerts} -> ${r.newAlerts} (forecast ${r.forecastMean.toFixed(1)}/day, sd ${r.forecastSd.toFixed(1)})`));
      break;
    case "approvals_verified":
      console.log(e.ok ? C.green(`         approvals verified (${e.approvals.length} tokens)`) : C.red(`         approvals REFUSED: ${e.reason}`));
      break;
    case "rollout":
      console.log(C.blue(`         flag ${e.state.ruleId} v${e.state.version} -> ${e.state.mode}${e.state.mode === "canary" ? ` ${e.state.canaryPct}%` : ""}`));
      break;
    case "day": {
      const parts = Object.entries(e.day.perRule).map(([r, v]) => `${r.slice(4)}=${v.observed}${v.drift ? "!" : ""}`);
      console.log(C.dim(`         day ${String(e.day.index).padStart(2)} ${e.day.day} ${e.day.phase.padEnd(6)} ${parts.join("  ")}`));
      break;
    }
    case "rollback":
      console.log(C.red(`         ROLLBACK ${e.ruleId} -> v${e.toVersion} (commit ${e.commit}): ${e.reason}`));
      break;
    case "log":
      console.log(C.dim(`         ${e.text}`));
      break;
    case "thread":
      console.log(C.bold("\nGolden Thread"));
      console.log(formatThread(e.thread));
      break;
  }
}

async function main() {
  console.log(C.dim("All circulars, rules, approvers, loan data and alerts in this run are SYNTHETIC."));
  if (usingDevSecret()) console.log(C.dim("Approval tokens use the development HMAC secret (set NIYAM_APPROVAL_SECRET to change it)."));

  const ctx = await createContext({ path, emit: print });
  const bundle = await runProposal(ctx);

  console.log(C.bold("\nHuman gate"));
  const tokens: Record<string, string[]> = {};
  for (const d of bundle.drafts) {
    tokens[d.ruleId] = APPROVERS.map((a) => issueToken({ rule_id: d.ruleId, version: d.version, yaml: d.yaml }, a).token);
  }
  for (const a of APPROVERS) console.log(`  signed by ${a.name}, ${a.role}`);

  const ctx2 = await createContext({ path, emit: print, runId: ctx.runId });
  const res = await runRelease(ctx2, { bundle, tokens, injectDrift: !process.argv.includes("--no-drift") });
  if (!res.ok) process.exitCode = 1;
  console.log(C.dim(`\n${res.ok ? res.alerts.length : 0} alerts produced during rollout. Done.`));
}

main().catch((e) => {
  console.error(C.red(String(e?.stack ?? e)));
  process.exit(1);
});
