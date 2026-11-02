import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { Card, Flow, Next, PageHead, Section, Sources } from "@/components/story/Blocks";
import { FACTS } from "@/content/site";
import { PAPERS } from "@/content/research";
import { METRICS } from "@/niyam/data/semanticModel";
import { ALLOWLIST } from "@/niyam/mcp/allowlist";
import { TOOL_GROUPS } from "@/niyam/mcp/servers";

export const metadata: Metadata = {
  title: "Our solution and uniqueness",
  description: "NIYAM, Regulatory Circular to Live Rule Engine: seven agents over A2A, tools behind MCP, a regulatory knowledge graph, a bank semantic model, a typed rule language, two-person approval, shadow and canary rollout, a Sentinel and the Golden Thread audit.",
};

/** [agent, one-line job, what it produces] */
const AGENTS: [string, string, string][] = [
  ["Conductor", "The master agent. Receives the circular, finds the other agents by their Agent Cards, hands each one its task, and stops at the human gate.", "The run plan and its log"],
  ["Reader", "Reads the document. Text PDFs through PyMuPDF; complex or scanned pages through OCR; poor scans through olmOCR, a vision-language OCR. Splits it into numbered clauses and marks which ones bind this bank.", "Clauses, each with its applicability"],
  ["Extractor", "Finds the regulatory language: shall, must not, may, exceeding, not less than. Pulls out the subject, metric, operator, number and deadline, and quotes the exact source words.", "Typed obligations with source references"],
  ["Mapper", "Connects each obligation to the bank's live rules and internal policies through the knowledge graph.", "What to change, what is missing, what conflicts"],
  ["Author", "Turns each obligation into a rule draft in NIYAM's typed rule language, on a draft branch.", "Machine-readable rule drafts"],
  ["Validator", "Challenges every draft: right number, right operator, right scope? Writes boundary tests from the circular, and backtests on the bank's last 90 days.", "Objections, test results, impact report"],
  ["Release", "Checks both human signatures against the exact rule files, then rolls out: shadow, canary, live. Rolls back on drift.", "A live rule, or a refusal"],
];

const TOOL_USE: Record<string, string> = {
  "regulatory-kg": "Circulars, clauses, obligations, rules, policies and their links",
  "semantic-model": "Business terms to the bank's real columns",
  "dsl-compiler": "Checks a rule draft and compiles it to SQL",
  backtest: "Runs generated tests and the 90-day backtest in a sandbox",
  "git-draft": "Reads rules, commits drafts, shows diffs, reverts",
  approvals: "Verifies the two signed approval tokens",
  "deploy-monitor": "Shadow, canary and live switches, Sentinel check, rollback",
};

const RULE = `rule_id: SYN-EXP-012
version: 2
title: Group exposure report
applies_to: [ UCB ]
when:
  metric: group_exposure_pct_tier1
  op: ">"
  value: 12
  unit: pct
action: flag_for_report
source:
  circular: RBI-SYN-2026-017
  clause: 4(b)
  span: aggregate exposure exceeding 12 per cent of Tier 1 capital`;

export default function SolutionPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHead
          kicker="3 · Our solution and uniqueness"
          title="NIYAM: Regulatory Circular to Live Rule Engine"
          lede={
            <>
              Not an agent that reads a circular and tells you what to do. NIYAM turns the circular into a <b>tested, two-person-approved, monitored live rule</b>, and can prove why every alert fired.
            </>
          }
        />

        <Section id="workflow" title="The workflow" tone="surface">
          <Flow
            label="NIYAM workflow"
            steps={[
              { title: "New RBI circular", note: "PDF, web page or text" },
              { title: "NIYAM agents", note: "Conductor and six specialists", tone: "navy" },
              { title: "Knowledge graph + Bank Semantic Model", note: "what it means for this bank" },
              { title: "Executable rules", note: "typed rule language", tone: "accent" },
              { title: "Testing and validation", note: "boundary tests, 90-day backtest" },
              { title: "Human approval", note: "maker and checker sign", tone: "warn" },
              { title: "Shadow → canary → live", note: "safe rollout" },
              { title: "Monitoring", note: "Sentinel, rollback, Golden Thread", tone: "ok" },
            ]}
          />
        </Section>

        <Section id="agents" title="Seven agents, one job each" intro="Each agent is a specialist. None of them can do another's job, and none can touch production on its own.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {AGENTS.map(([name, job, out], i) => (
              <Card key={name} title={name} tone={i === 0 ? "navy" : name === "Validator" ? "bad" : name === "Release" ? "ok" : "plain"} tag={i === 0 ? "Master agent" : `Agent ${i}`}>
                {job}
                <span className={`ui mt-3 block text-[13.5px] ${i === 0 ? "text-on-navy-muted" : "text-muted"}`}>
                  <b>Output:</b> {out}
                </span>
              </Card>
            ))}
          </div>
          <p data-reveal className="ui mt-4 text-[13.5px] text-muted">
            In this demo the Reader takes text and .txt uploads; PDF and OCR intake is the production design.
          </p>
        </Section>

        <Section id="a2a" title="A2A: how agents talk to each other" tone="surface" intro="Agent-to-Agent (A2A) is an open protocol for agents to find each other, hand over tasks and exchange results in a standard format.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Card title="Why we need it" tone="accent">
              Seven specialists must pass work, results and objections between them. A2A gives every message the same shape, so any agent can be replaced or moved to its own server.
            </Card>
            <Card title="Agent Card">
              A small JSON file each agent publishes at <span className="code">/.well-known/agent-card.json</span>: its name, skills, inputs and address. The Conductor reads the cards to find who can do what.
            </Card>
            <Card title="Direct or through the Conductor?">
              The main flow goes through the Conductor. One exchange is direct: when the Validator objects, it sends an A2A task straight to the Author to fix the draft, at most three rounds, then a human decides. Every message is logged.
            </Card>
          </div>
        </Section>

        <Section id="mcp" title="MCP: a controlled gate to tools and data" intro="Model Context Protocol (MCP) is how an agent reaches tools and data. In NIYAM no agent touches a database, the rule repository or production directly.">
          <Flow
            label="How an MCP tool call is checked"
            steps={[
              { title: "Agent asks", note: "for a named tool" },
              { title: "MCP client checks", note: "is this agent allowed?", tone: "warn" },
              { title: "MCP server checks again", note: "permitted operation?", tone: "warn" },
              { title: "Tool runs", note: "on the real resource", tone: "navy" },
              { title: "Result returned", note: "and logged", tone: "ok" },
            ]}
          />
          <div className="mt-10 overflow-x-auto" data-reveal>
            <table className="ui w-full min-w-[720px] border-collapse text-[14.5px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-4 py-2 font-normal">MCP server</th>
                  <th className="px-4 py-2 font-normal">What it does</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(TOOL_GROUPS) as (keyof typeof TOOL_GROUPS)[]).map((g) => (
                  <tr key={g} className="odd:bg-surface">
                    <td className="code px-4 py-2.5 font-semibold text-ink">{g}</td>
                    <td className="px-4 py-2.5 text-ink">{TOOL_USE[g] ?? TOOL_GROUPS[g]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 data-reveal className="mt-12 text-[22px]">
            Why not let every agent access everything?
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <Card title="Security">Each agent gets only the tools it needs. The Extractor cannot deploy; the Author cannot approve.</Card>
            <Card title="Controlled execution">Tools take typed inputs and refuse anything else.</Card>
            <Card title="Auditability">Every call is recorded: which agent, which tool, what result.</Card>
            <Card title="Standardisation">One protocol for every tool, whatever is behind it.</Card>
            <Card title="Extensibility">A new data source is a new MCP server; the agents do not change.</Card>
          </div>
          <details data-reveal className="mt-6 bg-surface p-5">
            <summary className="ui cursor-pointer text-[15px] font-semibold text-ink">Each agent&apos;s allowlist</summary>
            <dl className="m-0 mt-4 grid gap-2">
              {Object.entries(ALLOWLIST).map(([agent, tools]) => (
                <div key={agent} className="grid gap-1 sm:grid-cols-[120px_1fr]">
                  <dt className="ui text-[14px] font-semibold capitalize text-ink">{agent}</dt>
                  <dd className="code m-0 text-[13px] text-muted">{tools.join(", ")}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Section>

        <Section id="graph" title="Knowledge graph: why NIYAM needs one" tone="surface">
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="A database stores facts">
              Rows in tables: this rule, this policy, this alert. Asking how they connect means many joins across many tables.
            </Card>
            <Card title="A knowledge graph stores facts and how they connect" tone="accent">
              Nodes are things (Circular, Clause, Obligation, Rule, Policy, Approval, Alert). Edges are the links between them (CONTAINS, DERIVED_FROM, MAPPED_TO, CONFLICTS_WITH, APPROVED, FIRED_BY).
            </Card>
          </div>
          <div className="mt-6">
            <Flow
              label="The chain NIYAM keeps in the graph"
              steps={[
                { title: "Circular" },
                { title: "Clause" },
                { title: "Obligation" },
                { title: "Rule version", tone: "navy" },
                { title: "Approval", tone: "warn" },
                { title: "Alert", tone: "ok" },
              ]}
            />
          </div>
          <p data-reveal className="mt-6 max-w-[70ch] text-[17px]">
            <b>Why Neo4j:</b> it stores this graph natively, and one Cypher query walks the whole chain, from an alert back to its sentence. The demo runs an in-memory graph with the same node and edge names.
          </p>
        </Section>

        <Section id="semantic" title="Bank Semantic Model: what the words mean in this bank's data" intro="A circular speaks business language. A bank's data speaks column names. The semantic model is the dictionary between them: business meaning, definition, unit, level and the exact columns.">
          <div className="grid gap-3 lg:grid-cols-3">
            {METRICS.map((m) => (
              <Card key={m.id} title={m.label} tag={`${m.grain} level · ${m.unit === "pct" ? "per cent" : m.unit}`}>
                {m.definition}
                <span className="code mt-3 block text-[12.5px] text-muted">{m.physical}</span>
              </Card>
            ))}
          </div>
          <p data-reveal className="mt-6 max-w-[70ch] text-[17px]">
            Agents may only use metrics defined here, so a rule can never point at a column that does not exist. A new bank changes this mapping, not the rules.
          </p>
        </Section>

        <Section id="dsl" title="A typed rule language, not raw SQL" tone="surface" intro="An LLM is good with sentences. A bank needs exact, executable rules. So the Author writes a small typed rule, which code checks and compiles to SQL.">
          <div className="grid gap-6 lg:grid-cols-2">
            <pre data-reveal className="code m-0 overflow-x-auto bg-navy p-5 text-[13px] leading-[1.6] text-on-navy">{RULE}</pre>
            <div className="space-y-3">
              <Card title="Why not let the LLM write SQL?" tone="bad">
                It can invent column names, write invalid syntax, flip <span className="code">&gt;</span> and <span className="code">&gt;=</span>, mix 12 with 0.12, or produce a statement that changes data.
              </Card>
              <Card title="What the typed rule guarantees" tone="ok">
                Every field has a type and an allowed set of values. Only known metrics, operators and units pass. Code, not the model, writes the SQL, and it runs read-only.
              </Card>
              <Card title="Easy to review">
                A compliance officer can read the rule above and check it against the circular. The source block ties it to the exact words.
              </Card>
            </div>
          </div>
        </Section>

        <Section id="llm" title="The model: Claude, but NIYAM does not depend on it" intro="Live mode uses Anthropic's Claude for the Extractor and Author. NIYAM works with any model, or none at all.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card title="Rule-based mode">The whole pipeline also runs with no LLM, so results are reproducible.</Card>
            <Card title="LLMs can hallucinate" tone="warn">So every answer is checked before it is used.</Card>
            <Card title="Quotes must be exact">Each obligation&apos;s source words must appear exactly in the clause, or it is rejected.</Card>
            <Card title="Then the gates" tone="ok">Semantic model, typed rule schema, compiler, generated tests and the Validator stop a wrong answer from reaching a human.</Card>
          </div>
        </Section>

        <Section id="rollout" title="Can AI change a live banking rule by itself? No." tone="surface" intro="NIYAM never lets an agent change production directly. A new rule earns its way in through three stages, after two humans sign.">
          <div className="grid gap-3 lg:grid-cols-3">
            <Card title="1 · Shadow" tag="Observe · days 1-3" tone="plain">
              The rule runs on live data but only logs what it would do. It blocks nothing. We compare its results with the backtest to learn how it behaves.
            </Card>
            <Card title="2 · Canary" tag="Limited · days 4-7" tone="warn">
              It runs for real on 10% of eligible customers, chosen by a stable hash. Errors and alert changes are watched; on drift, it rolls back.
            </Card>
            <Card title="3 · Live" tag="Everyone · day 8 on" tone="ok">
              Full rollout. The Sentinel keeps watching every day.
            </Card>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 data-reveal className="text-[22px]">
                What we watch after go-live
              </h3>
              <ul className="m-0 mt-4 grid gap-2 p-0 sm:grid-cols-2">
                {["Rule executions", "Alerts raised per day", "Alert rate vs forecast", "Customers flagged", "Error rate", "Execution time", "Analyst workload (hours)", "Rollbacks"].map((x) => (
                  <li key={x} data-reveal className="ui list-none bg-bg px-3 py-2 text-[14.5px] text-ink">
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <Card title="The Sentinel" tone="navy" tag="Automatic rollback">
              Each day it compares the live alert count with the backtest forecast band (average ± 3 standard deviations). Inside the band: healthy. Outside: an anomaly. It switches the rule off and reverts it in git automatically, then hands the incident to humans. Turning the rule back on is always a human decision.
            </Card>
          </div>
        </Section>

        <Section id="humans" title="Two humans, one signed approval" intro="Before anything ships, two different people in two different roles must sign.">
          <div className="grid gap-3 md:grid-cols-3">
            <Card title="Maker" tag="Chief Compliance Officer">
              Reviews and prepares the proposed rule change: the clause, the draft, the tests and the backtest.
            </Card>
            <Card title="Checker" tag="Head of Risk and IT Change">
              Independently reviews and authorises it. Must be a different person in a different role.
            </Card>
            <Card title="Signed approval token" tone="accent" tag="Tamper-proof">
              An HMAC-SHA256 signature over the rule id, version, the SHA-256 of the exact file, the approver and their role, valid 24 hours. Change one character after signing and Release refuses.
            </Card>
          </div>
        </Section>

        <Section id="thread" title="The Golden Thread audit" tone="surface" intro="Inspectors ask: why did this alert fire? NIYAM answers in one query, from the alert back to the sentence that caused it.">
          <Flow
            label="Golden Thread"
            steps={[
              { title: "Alert", note: "what fired, when", tone: "ok" },
              { title: "Rule version", note: "which commit", tone: "navy" },
              { title: "Approvals", note: "who signed, which file", tone: "warn" },
              { title: "Obligation", note: "the typed requirement" },
              { title: "Clause", note: "the exact words" },
              { title: "Circular", note: "RBI reference", tone: "accent" },
            ]}
          />
        </Section>

        <Sources
          items={[
            { label: "A2A Protocol specification", url: "https://a2a-protocol.org/latest/specification/" },
            { label: "Model Context Protocol specification", url: "https://modelcontextprotocol.io/specification/2025-06-18" },
            { label: "Hogan et al., Knowledge Graphs (ACM Computing Surveys)", url: "https://arxiv.org/abs/2003.02320" },
            { label: "Neo4j Cypher manual", url: "https://neo4j.com/docs/cypher-manual/current/introduction/" },
            { label: "Semantic layer: the dbt Semantic Layer", url: "https://docs.getdbt.com/docs/use-dbt-semantic-layer/dbt-sl" },
            { label: "PyMuPDF documentation", url: "https://pymupdf.readthedocs.io/en/latest/" },
            { label: "Tesseract OCR", url: "https://github.com/tesseract-ocr/tesseract" },
            { label: "olmOCR: PDFs with vision-language models (Allen AI)", url: "https://arxiv.org/abs/2502.18443" },
            { label: "A Survey on Hallucination in Large Language Models", url: "https://arxiv.org/abs/2311.05232" },
            ...PAPERS.map((p) => ({ label: p.title, url: p.url })),
            { label: "Least privilege (NIST glossary)", url: "https://csrc.nist.gov/glossary/term/least_privilege" },
            { label: "Dark launching (shadow mode), Martin Fowler", url: "https://martinfowler.com/bliki/DarkLaunching.html" },
            { label: "Canary release, Martin Fowler", url: "https://martinfowler.com/bliki/CanaryRelease.html" },
            { label: "Canarying releases, Google SRE Workbook", url: "https://sre.google/workbook/canarying-releases/" },
            { label: "Maker-checker control", url: "https://en.wikipedia.org/wiki/Maker-checker" },
            { label: FACTS.freeAi.source, url: FACTS.freeAi.url, note: "RBI's seven sutras for AI in finance" },
          ]}
        />
        <Next href="/architecture" label="See the architecture" text="Every part above is built and running. See how it fits together, or run it yourself." />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
