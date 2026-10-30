/**
 * Virtusa Jatayu Season 5 submission content.
 * USE_CASE is the official use-case text, verbatim. COVERAGE maps every listed item to code that
 * exists in this repository; nothing here should claim more than src/niyam/** does.
 */

export const USE_CASE: [string, string][] = [
  [
    "Problem Statement",
    "Banks must manually interpret regulatory circulars, identify applicable obligations, map them to internal policies and existing system rules, and coordinate with IT to implement changes. This process can take weeks or months, risks missing critical obligations, and may introduce incorrect rule scope or unexpected transaction impacts.",
  ],
  [
    "Description",
    "A multi-agent AI system reads regulatory circulars, determines applicability, extracts obligations, maps them to internal rules, drafts changes, backtests their impact, and prepares them for human approval. Approved changes are deployed through shadow mode, controlled rollout, monitoring, and rollback.",
  ],
  ["Why Agentic AI", "Specialized agents collaborate via A2A to interpret regulations, map policies, create rules, analyze impact, and iteratively resolve issues."],
  [
    "Workflow",
    "Circular Intake → Obligation Extraction → Policy Mapping → Rule Authoring → Backtesting → Impact Analysis → Validation → Human Approval → Shadow Deployment → Rollout & Monitoring.",
  ],
  [
    "Data Sources",
    "Regulatory circulars, internal policies, rule repositories, bank profiles, transaction data, backtest results, deployment metrics, and approval history.",
  ],
  [
    "Tech Stack",
    "Multi-agent orchestration, document retrieval, obligation registry, rule DSL, A2A messaging, sandbox engine, backtesting, version control, deployment APIs, monitoring, and LLMs.",
  ],
  [
    "Guardrails",
    "Draft-only rule changes, clause-level traceability, validation, mandatory human approval, controlled rollout, monitoring, rollback, and rate limits.",
  ],
  ["Enterprise Impact", "Faster regulatory implementation, fewer compliance gaps, reduced manual effort, better traceability, and safer rule deployment."],
];

export interface CoverageRow {
  /** The item exactly as the use case lists it. */
  item: string;
  /** How NIYAM implements it, in one or two sentences. */
  how: string;
  /** Where to see it running: a console section or an architecture section. */
  see: { label: string; href: string };
  /** Repository path of the code that does it. */
  file: string;
}

export interface CoverageGroup {
  id: string;
  title: string;
  rows: CoverageRow[];
}

const C = (section: string, label: string) => ({ label, href: `/console#${section}` });
const A = (section: string, label: string) => ({ label, href: `/architecture#${section}` });

export const COVERAGE: CoverageGroup[] = [
  {
    id: "cov-workflow",
    title: "Workflow",
    rows: [
      {
        item: "Circular Intake",
        how: "The Reader agent segments RBI paragraph numbering, such as 4 and 4(b), into clauses with stable IDs and decides for the bank's entity type whether each clause applies, is informational or does not apply, with a stated reason.",
        see: C("circular", "Console: circular"),
        file: "src/niyam/agents/reader.ts",
      },
      {
        item: "Obligation Extraction",
        how: "The Extractor turns each applicable clause into a typed obligation (metric, operator, threshold, scope). Its quoted span must be an exact substring of the clause or the knowledge graph refuses to store it.",
        see: C("obligations", "Console: obligations"),
        file: "src/niyam/agents/extractor.ts",
      },
      {
        item: "Policy Mapping",
        how: "The Mapper queries the knowledge graph for live rules measuring the same metric and for internal policy sections, and classifies each obligation as modify, gap, conflict or manual control.",
        see: C("mapping", "Console: mapping"),
        file: "src/niyam/agents/mapper.ts",
      },
      {
        item: "Rule Authoring",
        how: "The Author writes typed YAML rules and commits them only to a draft/* branch of the rule repository.",
        see: C("drafts", "Console: drafts"),
        file: "src/niyam/agents/author.ts",
      },
      {
        item: "Backtesting",
        how: "Old and new rule versions are compiled to SQL and replayed over 90 synthetic days of the loan book in a sandbox.",
        see: C("backtest", "Console: backtest"),
        file: "src/niyam/agents/validator.ts",
      },
      {
        item: "Impact Analysis",
        how: "From the backtest: change in alert count, newly flagged borrowers and groups, analyst hours at 45 minutes per alert, and items for the Board. In code this is part of the Validator, not a separate agent.",
        see: C("backtest", "Console: impact"),
        file: "src/niyam/agents/validator.ts",
      },
      {
        item: "Validation",
        how: "The Validator, deterministic and independent of the Author, checks operator, threshold, unit, scope and span, runs boundary tests generated from the obligation, and sends A2A objections back to the Author.",
        see: C("drafts", "Console: objections and tests"),
        file: "src/niyam/dsl/testgen.ts",
      },
      {
        item: "Human Approval",
        how: "Two named people in two roles sign HMAC tokens bound to the SHA-256 of the exact rule file. Change one byte and the signature no longer verifies.",
        see: C("approval", "Console: approval"),
        file: "src/niyam/approvals/token.ts",
      },
      {
        item: "Shadow Deployment",
        how: "For the first three days the new rule only logs what it would have flagged, with no effect on any borrower.",
        see: C("rollout", "Console: rollout"),
        file: "src/niyam/agents/release.ts",
      },
      {
        item: "Rollout & Monitoring",
        how: "Days 4 to 7 run a 10% canary chosen by a stable hash of the borrower ID, then the rule goes live. The Sentinel compares each day's alerts with the backtest forecast band.",
        see: C("rollout", "Console: rollout and Sentinel"),
        file: "src/niyam/agents/release.ts",
      },
    ],
  },
  {
    id: "cov-data",
    title: "Data sources",
    rows: [
      {
        item: "Regulatory circulars",
        how: "A synthetic RBI-style amending circular, read through the regulatory-kg MCP server and marked as untrusted text. A pasted circular can also be analysed.",
        see: C("circular", "Console: circular"),
        file: "src/niyam/data/circular.ts",
      },
      {
        item: "Internal policies",
        how: "A synthetic credit concentration policy whose sections are linked to the rules that implement them; the Mapper finds the Board-override conflict in section 7.2.",
        see: C("mapping", "Console: mapping"),
        file: "src/niyam/data/seed.ts",
      },
      {
        item: "Rule repositories",
        how: "A real git repository (isomorphic-git) holding the live rules as YAML, with draft/* branches and a protected main.",
        see: A("honest", "Architecture: what is real"),
        file: "src/niyam/git/repo.ts",
      },
      {
        item: "Bank profiles",
        how: "A synthetic urban co-operative bank profile (entity type, tier, Tier 1 capital) that the Reader scopes every clause against.",
        see: C("circular", "Console: applicability"),
        file: "src/niyam/data/bankProfile.ts",
      },
      {
        item: "Transaction data",
        how: "A synthetic loan book with a fixed seed: 706 borrowers, 90 days, 63,540 daily exposure rows, mapped to business metrics by the Bank Semantic Model. These are loan balances, not payment transactions.",
        see: C("backtest", "Console: backtest"),
        file: "src/niyam/data/loanBook.ts",
      },
      {
        item: "Backtest results",
        how: "Daily alert series for old and new versions; the forecast mean and spread become the band the Sentinel watches after release.",
        see: C("backtest", "Console: backtest"),
        file: "src/niyam/agents/validator.ts",
      },
      {
        item: "Deployment metrics",
        how: "Each rollout day records alerts observed per rule, the forecast band and a z-score, which decide whether the rule stays or rolls back.",
        see: C("rollout", "Console: rollout"),
        file: "src/niyam/agents/release.ts",
      },
      {
        item: "Approval history",
        how: "Signed approval tokens name approver, role, rule version and file hash; the promotion commit records the approvers and the Golden Thread shows them on every alert.",
        see: C("thread", "Console: Golden Thread"),
        file: "src/niyam/approvals/token.ts",
      },
    ],
  },
  {
    id: "cov-stack",
    title: "Tech stack",
    rows: [
      {
        item: "Multi-agent orchestration",
        how: "A Conductor and six agents (Reader, Extractor, Mapper, Author, Validator, Release). The Conductor finds agents by their Agent Card skills, delegates tasks and stops at the human gate.",
        see: A("agents", "Architecture: agents"),
        file: "src/niyam/pipeline.ts",
      },
      {
        item: "Document retrieval",
        how: "The Reader segments the circular into clauses, the knowledge graph stores and serves them, and the semantic-model server resolves clause wording to the bank's metrics.",
        see: C("circular", "Console: circular"),
        file: "src/niyam/mcp/servers.ts",
      },
      {
        item: "Obligation registry",
        how: "Obligation nodes in the regulatory knowledge graph, each linked to the clause it was derived from and to the rules that implement it.",
        see: A("graph", "Architecture: graph"),
        file: "src/niyam/graph/graph.ts",
      },
      {
        item: "Rule DSL",
        how: "Typed YAML with a strict schema that rejects unknown fields, metrics and operators, and a deterministic compiler to SQL. No model writes executable code.",
        see: A("dsl", "Architecture: DSL"),
        file: "src/niyam/dsl/schema.ts",
      },
      {
        item: "A2A messaging",
        how: "Agents talk only through A2A v1.0 JSON-RPC messages. Each publishes an Agent Card, and the same handler is served over HTTP at /a2a/{agent}.",
        see: A("agents", "Architecture: agents"),
        file: "src/niyam/a2a/runtime.ts",
      },
      {
        item: "Sandbox engine",
        how: "Compiled rules run on SQLite compiled to WebAssembly inside one serverless function; the SQL is portable to DuckDB or a bank warehouse.",
        see: A("honest", "Architecture: what is real"),
        file: "src/niyam/sql/engine.ts",
      },
      {
        item: "Backtesting",
        how: "The backtest MCP server runs generated rule tests and the 90-day old-against-new replay.",
        see: C("backtest", "Console: backtest"),
        file: "src/niyam/mcp/servers.ts",
      },
      {
        item: "Version control",
        how: "Every draft is a real commit with a real SHA on a draft branch; promotion is a merge to main and rollback is a revert commit.",
        see: C("tools", "Console: tool calls"),
        file: "src/niyam/git/repo.ts",
      },
      {
        item: "Deployment APIs",
        how: "The deploy-monitor MCP server: promote, set mode (shadow, canary, live) behind a feature flag, Sentinel check and rollback. Each deploy call re-verifies both signatures.",
        see: A("matrix", "Architecture: tool matrix"),
        file: "src/niyam/mcp/servers.ts",
      },
      {
        item: "Monitoring",
        how: "The Sentinel compares daily alerts with the backtest forecast band (mean plus or minus three standard deviations) and flags drift.",
        see: C("rollout", "Console: Sentinel"),
        file: "src/niyam/agents/release.ts",
      },
      {
        item: "LLMs",
        how: "Claude drafts for the Extractor and Author when an API key is configured; otherwise a rule-based path runs. Every answer is span-checked, schema-checked and tested, and the console shows which path ran.",
        see: A("agents", "Architecture: agents"),
        file: "src/niyam/llm/claude.ts",
      },
    ],
  },
  {
    id: "cov-guardrails",
    title: "Guardrails",
    rows: [
      {
        item: "Draft-only rule changes",
        how: "The Author's only write tool commits to draft/* branches, and the git-draft server refuses writes to main. Only Release can promote, and only with two valid signatures.",
        see: A("matrix", "Architecture: tool matrix"),
        file: "src/niyam/mcp/allowlist.ts",
      },
      {
        item: "Clause-level traceability",
        how: "The Golden Thread traces any alert to its rule version, approvals, obligation, clause and circular, down to the quoted span.",
        see: C("thread", "Console: Golden Thread"),
        file: "src/niyam/thread.ts",
      },
      {
        item: "Validation",
        how: "Schema validation, a metric check against the semantic model, and tests generated from the obligation rather than the draft, so a draft that misreads the clause fails its own tests.",
        see: C("drafts", "Console: tests"),
        file: "src/niyam/dsl/testgen.ts",
      },
      {
        item: "Mandatory human approval",
        how: "Promotion and every rollout step are refused unless two tokens from two different roles verify against the exact file.",
        see: C("approval", "Console: approval"),
        file: "src/niyam/approvals/token.ts",
      },
      {
        item: "Controlled rollout",
        how: "Shadow for three days, then a 10% canary for four days, then live.",
        see: C("rollout", "Console: rollout"),
        file: "src/niyam/agents/release.ts",
      },
      {
        item: "Monitoring",
        how: "The Sentinel checks every rule every rollout day. The console can inject a duplicated loan feed on day 10 to show it catching drift.",
        see: C("rollout", "Console: Sentinel"),
        file: "src/niyam/agents/release.ts",
      },
      {
        item: "Rollback",
        how: "On drift the feature flag goes off and a git revert commit restores the last approved version, with the reason logged.",
        see: C("rollout", "Console: rollback"),
        file: "src/niyam/mcp/servers.ts",
      },
      {
        item: "Rate limits",
        how: "Validator and Author objection rounds are capped at 3, after which a human gets both positions. Paid LLM calls are limited to 4 runs per address per 10 minutes, with the rule-based path as fallback.",
        see: A("coverage", "Architecture: coverage"),
        file: "src/niyam/pipeline.ts",
      },
    ],
  },
];

export const TEMPLATE: { id: string; title: string; paras: string[] }[] = [
  {
    id: "need",
    title: "Business need and opportunity",
    paras: [
      "RBI consolidated about 9,000 circulars into 244 Master Directions in November 2025, and they now change by amendment. Each amendment still has to be read, scoped, mapped to policy and turned into system rules by hand, and compliance officers say a full regulatory change still takes more than a year on average.",
      "Getting it wrong is costly: RBI imposed 353 penalties worth ₹54.78 crore in 2024-25, and 264 of them fell on co-operative banks. The opportunity is the last step existing tools leave to people: a tested, approved, monitored change to a live rule, traced to its clause.",
    ],
  },
  {
    id: "segment",
    title: "Target segment and market size",
    paras: [
      "First: the 1,457 urban co-operative banks and the larger of the 9,291 NBFCs registered with RBI. They carry the same regulatory load as large banks with far smaller compliance and IT teams. Next: large banks, as a regulation-to-rule layer over the engines they already run, and IT services firms that deliver compliance programmes.",
      "Analysts size the global RegTech market at roughly USD 15 to 19 billion in 2025, growing 17 to 21% a year.",
    ],
  },
  {
    id: "solution",
    title: "Solution details",
    paras: [
      "Seven A2A agents with one job each, seven MCP tool servers with per-agent allowlists, a regulatory knowledge graph, a typed rule DSL compiled to SQL, a 90-day backtest, two-person approval bound to the file hash, and a shadow, canary and live rollout with automatic rollback.",
      "Language work goes to agents; arithmetic, tests, deployment and rollback go to deterministic code; decisions go to people. Everything in the console runs live on synthetic data.",
    ],
  },
  {
    id: "future",
    title: "Future readiness",
    paras: [
      "Built on open protocols (A2A v1.0 and MCP), so each agent can run as its own service and each bank engine plugs in through an MCP adapter. The LLM can be swapped for a private or on-premise model through the same interface, and the design maps to the seven sutras of RBI's FREE-AI framework.",
      "Next steps: a read-only pilot with one co-operative bank or NBFC, connectors for AML, fraud and limit engines, tracking every Master Direction amendment as a diff, then SEBI and IRDAI packs, where only the segmenter and semantic model change.",
    ],
  },
];

export const VIRTUSA_FIT: [string, string][] = [
  [
    "An accelerator, not a replacement",
    "NIYAM sits above the AML, fraud and limit engines a BFSI client already runs. It writes the rule change, proves it on the client's history and hands it over for approval; the client's engine still executes it.",
  ],
  [
    "One adapter per client engine",
    "Agents reach the outside world only through MCP servers. Supporting a new client's rule engine means writing one deploy-monitor adapter for it, not changing the agents.",
  ],
  [
    "Onboarding is mapping",
    "Rules are written against business metrics in the Bank Semantic Model. Onboarding a client means mapping those metrics to the client's tables and columns; the rules, tests and release path stay the same.",
  ],
  [
    "Fits how services teams deliver",
    "Draft branches, diffs, signed approvals and a clause-level audit trail are artefacts a delivery team can review with the client's compliance and IT owners, engagement by engagement.",
  ],
];

/**
 * The Stage 1 submission proposed ten agent roles. The build runs seven agents: some roles are
 * combined, and the Sentinel became a tool rather than an agent. Stated openly for judges.
 */
export const ROLES: { proposed: string; built: string; note: string }[] = [
  { proposed: "0 · Conductor", built: "Conductor", note: "Same role: plans the run, finds agents by Agent Card skills, caps objection rounds, stops at the human gate." },
  { proposed: "1 · Circular Intake", built: "Reader", note: "Intake and applicability are one agent: it segments the circular and scopes each clause in the same pass." },
  { proposed: "2 · Applicability", built: "Reader", note: "Merged with intake (see above)." },
  { proposed: "3 · Obligation Extractor", built: "Extractor", note: "Same role. Spans are verified as exact substrings." },
  { proposed: "4 · Policy & Rule Mapper", built: "Mapper", note: "Same role: modify, gap, conflict and manual-control classification over the knowledge graph." },
  { proposed: "5 · Rule Author", built: "Author", note: "Same role: typed YAML drafts on draft/* git branches." },
  { proposed: "6 · Validator / Challenger", built: "Validator", note: "Same role. It is deterministic code, deliberately independent of the Author, not a second LLM." },
  { proposed: "7 · Backtester", built: "Validator (backtest-impact skill)", note: "No LLM was ever planned here, so it runs as a second skill of the Validator over the same sandbox." },
  { proposed: "8 · Impact Analyst", built: "Validator (backtest-impact skill)", note: "Impact figures come from the same backtest run; the console turns them into a plain-language narrative." },
  { proposed: "9 · Release Manager", built: "Release", note: "Same role: verifies two-person approval, then shadow, canary 10%, live." },
  { proposed: "10 · Sentinel Monitor", built: "deploy-monitor MCP tool, called by Release", note: "Drift checking is a tool the Release agent polls, so monitoring cannot deploy anything on its own." },
];

export const BUILD_STATUS: { part: string; status: "running" | "planned"; detail: string }[] = [
  { part: "Seven A2A agents with Agent Cards", status: "running", detail: "Live JSON-RPC endpoints at /a2a/{agent}; in-run calls carry the same serialised messages." },
  { part: "Seven MCP tool servers with allowlists", status: "running", detail: "Official MCP TypeScript SDK, checked by each agent's client and again by each server." },
  { part: "Typed rule DSL", status: "running", detail: "Rules are YAML validated by a strict typed schema, then compiled to SQL. YAML is the syntax; the schema is what makes it typed." },
  { part: "Two-person approval, shadow, canary, live, auto-rollback", status: "running", detail: "Run them in the console; the rollout covers 12 synthetic days after approval." },
  { part: "Regulatory knowledge graph", status: "running", detail: "An in-memory property graph built on every run, with the Neo4j node labels and relationships. Explore it in the console." },
  { part: "Neo4j database", status: "planned", detail: "Not connected in this deployment. The graph uses the Neo4j schema and the Golden Thread query is written in Cypher, so moving it to Neo4j is a storage change, not a redesign." },
  { part: "DuckDB sandbox", status: "planned", detail: "This deployment runs the same compiled SQL on SQLite (WebAssembly) so it fits in one serverless function." },
  { part: "Agents as separate services", status: "planned", detail: "All seven agents run in one deployment today; in a bank each would sit behind its own endpoint with the same cards and messages." },
];
