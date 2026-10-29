import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metricById, metricForText, METRICS } from "../data/semanticModel";
import { POLICIES } from "../data/seed";
import { compileRule } from "../dsl/compile";
import { parseRule, RuleParseError } from "../dsl/schema";
import { runTests } from "../dsl/testgen";
import { unifiedDiff } from "../git/repo";
import { runQuery } from "../sql/engine";
import { verifyTwoPerson } from "../approvals/token";
import { DRAFT_BRANCH, ruleFile, type NiyamContext } from "../context";
import { allowedFor } from "./allowlist";

/**
 * MCP tool servers, one per tool group. Each server is created per (agent, group) pair and
 * connected in-process; it knows which agent is calling and refuses tools outside that agent's
 * allowlist, so the allowlist holds even if a client is bypassed.
 */

export const TOOL_GROUPS = {
  "regulatory-kg": "Regulatory knowledge graph: circulars, clauses, obligations, policies, rules, lineage",
  "semantic-model": "Bank Semantic Model and bank profile: business terms to physical columns",
  "dsl-compiler": "Rule DSL schema validation and compilation to SQL",
  backtest: "Sandbox: generated rule tests and 90-day backtests on the synthetic loan book",
  "git-draft": "Rule repository: read rules, commit to draft/* branches, diffs, reverts",
  approvals: "Two-person approval token verification",
  "deploy-monitor": "Feature-flagged rollout (shadow, canary, live), Sentinel drift check, rollback",
} as const;

export type ToolGroup = keyof typeof TOOL_GROUPS;

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
});
const fail = (msg: string) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
  isError: true,
});

type Handler<T> = (args: T) => Promise<unknown> | unknown;

export function createToolServer(ctx: NiyamContext, group: ToolGroup, callerAgent: string): McpServer {
  const server = new McpServer({ name: `niyam-${group}`, version: "1.0.0" });
  const allowed = new Set(allowedFor(callerAgent));

  function tool<S extends z.ZodRawShape>(name: string, description: string, shape: S, fn: Handler<z.infer<z.ZodObject<S>>>) {
    server.registerTool(name, { description, inputSchema: shape }, (async (args: z.infer<z.ZodObject<S>>) => {
      if (!allowed.has(name)) return fail(`DENIED: ${callerAgent} is not allowlisted for ${name}`);
      try {
        return json(await fn(args));
      } catch (e) {
        if (e instanceof RuleParseError) return fail(e.issues.join("; "));
        return fail((e as Error).message);
      }
    }) as never);
  }

  switch (group) {
    case "regulatory-kg": {
      tool("kg_read_circular", "Read the circular text and metadata (marked untrusted data)", {}, () => ({
        ref: ctx.circular.ref,
        title: ctx.circular.title,
        issuedOn: ctx.circular.issuedOn,
        amends: ctx.circular.amends,
        synthetic: ctx.circular.synthetic,
        untrusted_text: ctx.circular.text,
      }));
      tool(
        "kg_write_clauses",
        "Record segmented clauses and their applicability",
        { clauses: z.array(z.object({ id: z.string(), number: z.string(), text: z.string(), applicability: z.string(), reason: z.string() })) },
        ({ clauses }) => {
          const c = ctx.circular;
          ctx.graph.upsert(c.ref, "Circular", { ref: c.ref, title: c.title, issuedOn: c.issuedOn, synthetic: true });
          ctx.graph.link("RBI", "ISSUED", c.ref);
          ctx.graph.link(c.ref, "AMENDS", "MD-SYN-LEF-2025");
          for (const cl of clauses) {
            ctx.graph.upsert(cl.id, "Clause", { number: cl.number, text: cl.text, applicability: cl.applicability, reason: cl.reason });
            ctx.graph.link(c.ref, "CONTAINS", cl.id);
          }
          return { written: clauses.length };
        },
      );
      tool("kg_read_clauses", "Read applicable clauses", { only_applicable: z.boolean().default(true) }, ({ only_applicable }) =>
        ctx.clauses.filter((c) => !only_applicable || c.applicability === "applies"),
      );
      tool(
        "kg_write_obligations",
        "Record verified obligations, each linked to its clause",
        { obligations: z.array(z.object({ id: z.string(), clauseId: z.string(), span: z.string() }).passthrough()) },
        ({ obligations }) => {
          for (const o of obligations) {
            const clause = ctx.graph.get(o.clauseId);
            const text = String(clause?.props.text ?? "");
            if (!text.includes(o.span)) throw new Error(`Span for ${o.id} is not an exact substring of ${o.clauseId}`);
            ctx.graph.upsert(o.id, "Obligation", o as Record<string, unknown>);
            ctx.graph.link(o.id, "DERIVED_FROM", o.clauseId);
          }
          return { written: obligations.length };
        },
      );
      tool("kg_read_obligations", "Read verified obligations", {}, () => ctx.obligations);
      tool("kg_find_rules", "Find live rules that measure a metric", { metric: z.string() }, ({ metric }) =>
        ctx.graph.in(metric, "MEASURES").map((r) => ({ ruleId: r.id, ...r.props })),
      );
      tool("kg_find_policies", "Find internal policy sections linked to a rule or a metric", { rule_id: z.string().optional(), metric: z.string().optional() }, ({ rule_id, metric }) =>
        POLICIES.filter((p) => (rule_id && p.implementedBy.includes(rule_id)) || (metric && p.permits?.metric === metric)),
      );
      tool(
        "kg_link_mapping",
        "Record a mapping edge between an obligation and a rule or policy",
        { from: z.string(), to: z.string(), type: z.enum(["MAPPED_TO", "CONFLICTS_WITH"]), note: z.string().optional() },
        ({ from, to, type, note }) => {
          if (!ctx.graph.get(to)) ctx.graph.upsert(to, "Rule", { proposed: true });
          ctx.graph.link(from, type, to, note ? { note } : undefined);
          return { ok: true };
        },
      );
      tool("kg_stats", "Graph statistics", {}, () => ctx.graph.stats());
      break;
    }
    case "semantic-model": {
      tool("sm_bank_profile", "Read the bank profile used for applicability", {}, () => ctx.profile);
      tool("sm_resolve_metric", "Resolve business language in a clause to a semantic-model metric", { text: z.string() }, ({ text }) => {
        const m = metricForText(text);
        return m ? { metric: m.id, label: m.label, unit: m.unit, grain: m.grain, physical: m.physical } : { metric: null };
      });
      tool("sm_list_metrics", "List all metrics", {}, () => METRICS.map(({ phrases: _p, ...m }) => m));
      break;
    }
    case "dsl-compiler": {
      tool("dsl_validate", "Validate rule YAML against the typed DSL schema", { yaml: z.string() }, ({ yaml }) => {
        const r = parseRule(yaml);
        if (!metricById(r.when.metric)) throw new Error(`Unknown metric ${r.when.metric}`);
        return { valid: true, rule_id: r.rule_id, version: r.version };
      });
      tool("dsl_compile", "Compile rule YAML to SQL", { yaml: z.string() }, ({ yaml }) => compileRule(parseRule(yaml)));
      break;
    }
    case "backtest": {
      tool("bt_run_tests", "Run the obligation-derived tests for a rule against its compiled SQL", { yaml: z.string() }, async ({ yaml }) => {
        const rule = parseRule(yaml);
        const tests = ctx.tests.filter((t) => t.ruleId === rule.rule_id);
        return runTests(rule, tests);
      });
      tool(
        "bt_run_backtest",
        "Replay the 90-day synthetic loan book through old and new rule versions",
        { old_yaml: z.string().optional(), new_yaml: z.string() },
        ({ old_yaml, new_yaml }) => {
          const newer = compileRule(parseRule(new_yaml));
          const newRows = runQuery(ctx.book, newer.sql);
          const oldRows = old_yaml ? runQuery(ctx.book, compileRule(parseRule(old_yaml)).sql) : [];
          return { old: oldRows, new: newRows };
        },
      );
      break;
    }
    case "git-draft": {
      tool("git_read_rule", "Read a rule file from main or a branch", { rule_id: z.string(), ref: z.string().optional() }, async ({ rule_id, ref }) => {
        const content = await ctx.repo.read(ruleFile(rule_id), ref ?? "main");
        return { rule_id, ref: ref ?? "main", content: content ?? null };
      });
      tool(
        "git_commit_draft",
        "Commit a rule file to the circular's draft branch (draft/* only)",
        { rule_id: z.string(), content: z.string(), message: z.string(), branch: z.string().optional() },
        async ({ rule_id, content, message, branch }) => {
          parseRule(content);
          return ctx.repo.commitDraft(branch ?? DRAFT_BRANCH(ctx.circular.ref), ruleFile(rule_id), content, message);
        },
      );
      tool("git_diff", "Unified diff of a rule between main and the draft branch", { rule_id: z.string() }, async ({ rule_id }) => {
        const before = (await ctx.repo.read(ruleFile(rule_id), "main")) ?? "";
        const after = (await ctx.repo.read(ruleFile(rule_id), DRAFT_BRANCH(ctx.circular.ref))) ?? "";
        return { diff: unifiedDiff(before, after, `main/${ruleFile(rule_id)}`, `${DRAFT_BRANCH(ctx.circular.ref)}/${ruleFile(rule_id)}`) };
      });
      tool("git_log", "Commit log", { ref: z.string().default("main") }, ({ ref }) => ctx.repo.log(ref));
      break;
    }
    case "approvals": {
      tool(
        "appr_verify",
        "Verify two-person approval tokens against the exact rule file",
        { rule_id: z.string(), yaml: z.string(), tokens: z.array(z.string()) },
        ({ rule_id, yaml, tokens }) => verifyTwoPerson(tokens, yaml, rule_id),
      );
      break;
    }
    case "deploy-monitor": {
      tool(
        "deploy_set_mode",
        "Set a rule's rollout mode behind its feature flag (requires verified approvals)",
        {
          rule_id: z.string(),
          version: z.number(),
          mode: z.enum(["shadow", "canary", "live"]),
          canary_pct: z.number().min(0).max(100).default(10),
          yaml: z.string(),
          tokens: z.array(z.string()),
        },
        ({ rule_id, version, mode, canary_pct, yaml, tokens }) => {
          const v = verifyTwoPerson(tokens, yaml, rule_id);
          if (!v.ok) throw new Error(`Deploy refused: ${v.reason}`);
          ctx.rollout[rule_id] = { ruleId: rule_id, version, mode, canaryPct: mode === "canary" ? canary_pct : mode === "live" ? 100 : 0 };
          return ctx.rollout[rule_id];
        },
      );
      tool(
        "deploy_promote",
        "Merge the approved draft branch into main (fast-forward; requires verified approvals for every rule on it)",
        { branch: z.string(), rules: z.array(z.object({ rule_id: z.string(), yaml: z.string(), tokens: z.array(z.string()) })) },
        async ({ branch, rules }) => {
          const approvers = new Set<string>();
          for (const r of rules) {
            const v = verifyTwoPerson(r.tokens, r.yaml, r.rule_id);
            if (!v.ok) throw new Error(`Promotion refused for ${r.rule_id}: ${v.reason}`);
            v.results.forEach((x) => approvers.add(x.payload!.approver_name));
            const onBranch = await ctx.repo.read(ruleFile(r.rule_id), branch);
            if (onBranch !== r.yaml) throw new Error(`Promotion refused: ${r.rule_id} on ${branch} differs from the approved file`);
          }
          return ctx.repo.promote(branch, [...approvers]);
        },
      );
      tool(
        "deploy_sentinel_check",
        "Sentinel drift check: compare an observed daily alert count with the backtest forecast band",
        { rule_id: z.string(), observed: z.number(), forecast_mean: z.number(), forecast_sd: z.number(), k: z.number().default(3) },
        ({ rule_id, observed, forecast_mean, forecast_sd, k }) => {
          const upper = forecast_mean + k * Math.max(forecast_sd, 0.5);
          const lower = Math.max(0, forecast_mean - k * Math.max(forecast_sd, 0.5));
          const z = (observed - forecast_mean) / Math.max(forecast_sd, 0.5);
          return { rule_id, observed, band: [lower, upper], z, drift: observed > upper || observed < lower };
        },
      );
      tool(
        "deploy_rollback",
        "Roll a rule back to its previous approved version: flag off, then a git revert commit",
        { rule_id: z.string(), to_version: z.number(), reason: z.string() },
        async ({ rule_id, to_version, reason }) => {
          const commit = await ctx.repo.revertFile(ruleFile(rule_id), ctx.seedCommit.sha, `Auto-rollback ${rule_id} to v${to_version}: ${reason}`);
          ctx.rollout[rule_id] = { ruleId: rule_id, version: to_version, mode: "rolled_back", canaryPct: 0 };
          return { commit, state: ctx.rollout[rule_id] };
        },
      );
      break;
    }
  }
  return server;
}
