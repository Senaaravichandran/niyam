import type { Database } from "sql.js";
import { BANK_PROFILE, type BankProfile } from "./data/bankProfile";
import { CIRCULAR, type CircularSource } from "./data/circular";
import { EXISTING_RULES, POLICIES } from "./data/seed";
import { METRICS } from "./data/semanticModel";
import { toYaml } from "./dsl/schema";
import { KnowledgeGraph } from "./graph/graph";
import { RuleRepo, type CommitInfo } from "./git/repo";
import { getBookDb } from "./sql/engine";
import type { RunEvent } from "./events";
import type {
  Clause,
  MappingResult,
  Obligation,
  Objection,
  RejectedObligation,
  RuleDraft,
  TestCase,
  TestResult,
} from "./types";

export type ExecutionPath = "rule-based" | "llm";

export interface McpCallRecord {
  at: number;
  agent: string;
  server: string;
  tool: string;
  allowed: boolean;
  ms: number;
  error?: string;
}

export interface RolloutState {
  ruleId: string;
  version: number;
  mode: "off" | "shadow" | "canary" | "live" | "rolled_back";
  canaryPct: number;
}

export interface NiyamContext {
  runId: string;
  path: ExecutionPath;
  circular: CircularSource;
  profile: BankProfile;
  graph: KnowledgeGraph;
  repo: RuleRepo;
  seedCommit: CommitInfo;
  book: Database;
  clauses: Clause[];
  obligations: Obligation[];
  rejected: RejectedObligation[];
  mapping?: MappingResult;
  drafts: RuleDraft[];
  tests: TestCase[];
  testResults: TestResult[];
  objections: Objection[];
  rollout: Record<string, RolloutState>;
  mcpLog: McpCallRecord[];
  llmNotes: string[];
  emit: (e: RunEvent) => void;
}

export const ruleFile = (ruleId: string) => `${ruleId}.yaml`;
export const DRAFT_BRANCH = (circular: string) => `draft/${circular}`;

export async function createContext(opts: {
  runId?: string;
  path?: ExecutionPath;
  circular?: CircularSource;
  emit?: (e: RunEvent) => void;
} = {}): Promise<NiyamContext> {
  const circular = opts.circular ?? CIRCULAR;
  const graph = new KnowledgeGraph();
  seedGraph(graph);
  const files: Record<string, string> = {};
  for (const r of EXISTING_RULES) files[ruleFile(r.rule_id)] = toYaml(r);
  const { repo, commit } = await RuleRepo.init(files);
  for (const r of EXISTING_RULES) {
    graph.upsert(`${r.rule_id}@v1`, "RuleVersion", { version: 1, commit: commit.short, status: "live" });
    graph.link(r.rule_id, "HAS_VERSION", `${r.rule_id}@v1`);
  }
  const book = await getBookDb();
  return {
    runId: opts.runId ?? `RUN-${Date.now().toString(36).toUpperCase()}`,
    path: opts.path ?? "rule-based",
    circular,
    profile: BANK_PROFILE,
    graph,
    repo,
    seedCommit: commit,
    book,
    clauses: [],
    obligations: [],
    rejected: [],
    drafts: [],
    tests: [],
    testResults: [],
    objections: [],
    rollout: Object.fromEntries(
      EXISTING_RULES.map((r) => [r.rule_id, { ruleId: r.rule_id, version: 1, mode: "live", canaryPct: 100 }]),
    ),
    mcpLog: [],
    llmNotes: [],
    emit: opts.emit ?? (() => {}),
  };
}

function seedGraph(g: KnowledgeGraph) {
  g.upsert("RBI", "Regulator", { name: "Reserve Bank of India" });
  g.upsert("MD-SYN-LEF-2025", "Circular", {
    ref: "MD-SYN-LEF-2025",
    title: "Master Direction on Large Exposures (SYNTHETIC)",
    synthetic: true,
  });
  g.link("RBI", "ISSUED", "MD-SYN-LEF-2025");
  for (const m of METRICS) g.upsert(m.id, "Metric", { label: m.label, physical: m.physical });
  const policyIds = new Set<string>();
  for (const p of POLICIES) {
    g.upsert(p.id, "Policy", { policy: p.policy, section: p.section, text: p.text, permits: p.permits });
    policyIds.add(p.id);
  }
  for (const r of EXISTING_RULES) {
    g.upsert(r.rule_id, "Rule", { title: r.title, metric: r.when.metric });
    g.link(r.rule_id, "MEASURES", r.when.metric);
  }
  for (const p of POLICIES) for (const rid of p.implementedBy) g.link(p.id, "IMPLEMENTED_BY", rid);
}
