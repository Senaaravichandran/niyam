/** Research behind NIYAM. Checked 29 October 2026; sources linked on the page. */

export const COMPETITORS: { name: string; what: string; stops: string }[] = [
  {
    name: "CUBE (with Thomson Reuters Regulatory Intelligence, 4CRisk.ai)",
    what: "AI horizon scanning and mapping of regulatory obligations to policies and controls.",
    stops: "Stops at the obligation-to-control map; does not author, test or deploy executable monitoring rules.",
  },
  {
    name: "Ascent RegTech",
    what: "Builds obligation registers from rulebooks.",
    stops: "Stops at the register.",
  },
  {
    name: "Corlytics",
    what: "Regulatory change monitoring and policy management.",
    stops: "Stops at policy and control alignment.",
  },
  {
    name: "Compliance.ai (Archer)",
    what: "Regulatory change monitoring feeding a GRC workflow.",
    stops: "Stops at alerts and tasks.",
  },
  {
    name: "Wolters Kluwer OneSumX, Regnology",
    what: "Regulatory reporting and capital calculation engines.",
    stops: "Rule changes ship as vendor releases, not derived per bank from each circular.",
  },
  {
    name: "IBM OpenPages with watsonx",
    what: "GRC workflow with an LLM assistant.",
    stops: "Tracks obligations and controls; does not compile them into live detection rules.",
  },
  {
    name: "Tookitaki, Signzy",
    what: "AML transaction monitoring and KYC onboarding.",
    stops: "Scenario libraries come from their own community, not from parsing a bank's circulars.",
  },
];

export const PAPERS: { title: string; who: string; where: string; url: string; finding: string; used: string }[] = [
  {
    title: "ComplianceNLP: Knowledge-Graph-Augmented RAG for Multi-Framework Regulatory Gap Detection",
    who: "Guo, Wu, Yiu (HKU)",
    where: "arXiv:2604.23585, ACL 2026 Industry Track",
    url: "https://arxiv.org/abs/2604.23585",
    finding: "A knowledge graph of 12,847 provisions lifted gap detection to 87.7 F1; graph re-ranking was the largest single gain, and a four-month parallel run measured 3.1 times analyst efficiency.",
    used: "Why the Mapper reasons over a regulatory knowledge graph rather than free-text retrieval.",
  },
  {
    title: "Code-as-Auditor: Executable Compliance Reasoning via Regulation-to-Code",
    who: "Kim, Kwack, Jang, Kim, Woo",
    where: "arXiv:2609.19199, CIKM 2026",
    url: "https://arxiv.org/abs/2609.19199",
    finding: "Separates applicability, compliance and legal effect into executable structure, with a generator and a verifier.",
    used: "The Reader scopes before the Extractor extracts, and the Author and Validator are separate agents.",
  },
  {
    title: "Compliance-to-Code: Enhancing Financial Compliance Checking via Code Generation",
    who: "Li et al.",
    where: "arXiv:2505.19804",
    url: "https://arxiv.org/abs/2505.19804",
    finding: "1,159 clauses from 361 Chinese financial regulations decomposed into subject, condition, constraint and context, each mapped to code.",
    used: "NIYAM's obligation schema (actor, modality, metric, operator, threshold, scope) follows the same decomposition, but compiles a typed DSL instead of free code.",
  },
  {
    title: "Regulatory Graphs and GenAI for Real-Time Transaction Monitoring and Compliance Explanation in Banking",
    who: "arXiv preprint",
    where: "arXiv:2506.01093",
    url: "https://arxiv.org/abs/2506.01093",
    finding: "Graph-based monitoring with explanations grounded in the clause that applies.",
    used: "The Golden Thread: every alert carries a path back to its clause.",
  },
];

export const SUTRAS: [string, string][] = [
  ["Trust is the Foundation", "Spans are verified, never trusted; every number on this site that is not synthetic has a source."],
  ["People First", "No rule reaches production without two named people signing the exact file."],
  ["Innovation over Restraint", "Agents do the reading and drafting that takes compliance teams weeks."],
  ["Fairness and Equity", "Rules are typed and scoped by entity type; backtests show who is newly flagged before anyone signs."],
  ["Accountability", "Approval tokens name the approver and role; the Golden Thread names them on every alert."],
  ["Understandable by Design", "Every objection states expected, found and the clause; every alert links to its sentence."],
  ["Safety, Resilience and Sustainability", "Shadow, canary, Sentinel drift checks and automatic rollback; deterministic code for maths and deployment."],
];

export const QA: [string, string][] = [
  [
    "An LLM invents a threshold. What stops it going live?",
    "Five independent layers. The Extractor's quote must be an exact substring of the clause. The rule must pass a strict schema. The Validator, which never shares code with the Author, generates boundary tests from the obligation and runs the compiled SQL. Two people sign a hash of the exact file. Then three days of shadow mode with no customer effect. No path skips a human.",
  ],
  [
    "Why several agents and not one prompt?",
    "Separation of duties, the control banks already use. The Author cannot validate its own work, the Extractor cannot deploy, and Release cannot write rules. Each agent's tools are limited by its Agent Card and checked by every MCP server. One agent would hold every permission and grade its own homework.",
  ],
  [
    "Does this run at bank scale?",
    "Agents are off the hot path: they run once per circular. What runs per transaction is the compiled SQL, which is portable to DuckDB, the bank's warehouse or its rule engine. The demo backtests 63,540 daily rows in about two seconds inside one serverless function.",
  ],
  [
    "What about data residency and the RBI's AI expectations?",
    "Models see circular text and rule metadata, never customer data. Backtests run inside the bank's boundary. Every model call is logged with the path that ran, and the design maps to the FREE-AI sutras below. The LLM can be swapped for a private model through the same interfaces.",
  ],
  [
    "What happens when a live rule misbehaves?",
    "The Sentinel compares each day's alerts with the backtest forecast band. A breach turns the feature flag off and writes a git revert to the last approved version, then routes an incident to humans. Try it in the console: the duplicated loan feed on day 10 is caught and rolled back.",
  ],
  [
    "How is the policy conflict handled?",
    "The Mapper found that internal policy §7.2 lets the Board approve group exposure up to 15%, while the circular sets 12% and forbids overrides. It routes a policy-update task to Compliance and the Validator rejects any draft that keeps the Board exception.",
  ],
];

export const ROADMAP: [string, string, string][] = [
  ["Now", "Proof of concept", "Seven agents over A2A, seven MCP servers, typed DSL, backtest, two-person approval, rollout and rollback, Golden Thread. Synthetic data."],
  ["0 to 3 months", "Read-only pilot", "One urban co-operative bank or NBFC: obligation register and impact reports only, no deployment. Measure extraction precision and analyst hours saved."],
  ["3 to 6 months", "Rule engine connectors", "MCP adapters for the bank's AML, fraud and limit engines; Neo4j and DuckDB in the bank's boundary; private model option."],
  ["6 to 12 months", "Master Direction tracker", "Follow every amendment to the 244 Master Directions as a diff, and keep the knowledge graph current."],
  ["12 to 24 months", "More regulators", "SEBI and IRDAI packs. Only the Reader's segmenter and the semantic model change; the agents, DSL and release path stay."],
];
