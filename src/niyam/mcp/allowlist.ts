/**
 * Least-privilege tool allowlists. Each agent's Agent Card publishes its list, the agent's MCP
 * client refuses anything outside it, and every MCP server re-checks it on receipt.
 */

export const TOOL_SERVER: Record<string, string> = {
  kg_read_circular: "regulatory-kg",
  kg_write_clauses: "regulatory-kg",
  kg_read_clauses: "regulatory-kg",
  kg_write_obligations: "regulatory-kg",
  kg_read_obligations: "regulatory-kg",
  kg_find_rules: "regulatory-kg",
  kg_find_policies: "regulatory-kg",
  kg_link_mapping: "regulatory-kg",
  kg_stats: "regulatory-kg",
  sm_bank_profile: "semantic-model",
  sm_resolve_metric: "semantic-model",
  sm_list_metrics: "semantic-model",
  dsl_validate: "dsl-compiler",
  dsl_compile: "dsl-compiler",
  bt_run_tests: "backtest",
  bt_run_backtest: "backtest",
  git_read_rule: "git-draft",
  git_commit_draft: "git-draft",
  git_diff: "git-draft",
  git_log: "git-draft",
  appr_verify: "approvals",
  deploy_promote: "deploy-monitor",
  deploy_set_mode: "deploy-monitor",
  deploy_sentinel_check: "deploy-monitor",
  deploy_rollback: "deploy-monitor",
};

export const ALLOWLIST: Record<string, string[]> = {
  conductor: ["kg_read_circular", "kg_stats"],
  reader: ["kg_read_circular", "kg_write_clauses", "sm_bank_profile"],
  extractor: ["kg_read_clauses", "sm_resolve_metric", "kg_write_obligations"],
  mapper: ["kg_read_obligations", "kg_find_rules", "kg_find_policies", "kg_link_mapping", "git_read_rule"],
  author: ["git_read_rule", "git_commit_draft", "dsl_validate", "dsl_compile"],
  validator: ["kg_read_obligations", "dsl_validate", "dsl_compile", "bt_run_tests", "bt_run_backtest", "git_diff"],
  release: ["appr_verify", "deploy_promote", "deploy_set_mode", "deploy_sentinel_check", "deploy_rollback", "git_log"],
};

export function allowedFor(agent: string): string[] {
  return ALLOWLIST[agent] ?? [];
}
