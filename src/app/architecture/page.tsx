import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { REPO_URL } from "@/content/site";
import { SNAPSHOT } from "@/content/runSnapshot";
import { AGENTS } from "@/niyam/a2a/cards";
import { GOLDEN_THREAD_CYPHER } from "@/niyam/graph/graph";
import { ALLOWLIST, TOOL_SERVER } from "@/niyam/mcp/allowlist";
import { TOOL_GROUPS } from "@/niyam/mcp/servers";

export const metadata: Metadata = {
  title: "Architecture",
  description: "How NIYAM is built: a Conductor and six agents over A2A, seven MCP tool servers with allowlists, a regulatory knowledge graph, a typed rule DSL compiled to SQL, and a guarded release path.",
};

const FINAL_012 = `rule_id: SYN-EXP-012
version: 2
status: draft
title: Group exposure report
applies_to: [ UCB, NBFC-ML, NBFC-UL ]
when:
  metric: group_exposure_pct_tier1
  op: ">"
  value: 12
  unit: pct
action: flag_for_report
severity: medium
source:
  circular: RBI-SYN-2026-017
  clause: 4(b)
  obligation: OBL-017-4b
  span: aggregate exposure exceeding 12 per cent of Tier 1 capital`;

const COMPARATORS: [string, string, string][] = [
  ["exceeding, in excess of, more than", ">", "Strictly above the limit; the limit itself is allowed"],
  ["shall not exceed, not exceeding", ">", "A ceiling: a breach is anything strictly above it"],
  ["not less than, at least", "<", "A floor: a breach is anything strictly below it"],
  ["less than, below", ">=", "Must stay strictly below; reaching the limit is a breach"],
];

const COVERAGE: [string, string, string][] = [
  ["Circular intake", "Reader agent segments RBI numbering into clauses with stable IDs", "src/niyam/agents/reader.ts"],
  ["Applicability", "Reader scopes each clause against the bank profile with a stated reason", "src/niyam/agents/reader.ts"],
  ["Obligation extraction", "Extractor: typed obligation with exact, verified source span", "src/niyam/agents/extractor.ts"],
  ["Policy mapping", "Mapper walks the knowledge graph: modify, gap, conflict, manual control", "src/niyam/agents/mapper.ts"],
  ["Rule authoring", "Author writes typed YAML on draft/* git branches", "src/niyam/agents/author.ts"],
  ["Backtesting", "90 synthetic days, old against new, through compiled SQL", "src/niyam/agents/validator.ts"],
  ["Impact analysis", "Alert delta, newly flagged subjects, analyst hours, Board items", "src/niyam/agents/validator.ts"],
  ["Validation", "Operator, threshold, unit, scope, span and generated boundary tests; A2A objections", "src/niyam/agents/validator.ts"],
  ["Human approval", "Two people, two roles, HMAC tokens bound to the rule file hash", "src/niyam/approvals/token.ts"],
  ["Shadow deployment", "Three days logging only, no customer effect", "src/niyam/agents/release.ts"],
  ["Rollout and monitoring", "10% canary by stable hash, then live; Sentinel drift band", "src/niyam/agents/release.ts"],
  ["Rollback", "Flag off and a git revert commit, logged", "src/niyam/mcp/servers.ts"],
  ["Rate limits", "Objection rounds capped at 3; LLM calls rate-limited per address", "src/niyam/pipeline.ts"],
  ["Clause-level traceability", "Golden Thread from any alert to the sentence that caused it", "src/niyam/thread.ts"],
];

const HONEST: [string, string, string][] = [
  ["Agents", "Seven A2A v1.0 JSON-RPC agents in one Next.js deployment; in-run calls use a loopback transport carrying serialised JSON-RPC", "Each agent as its own service behind the bank's gateway, same cards and messages"],
  ["Tools", "Seven MCP servers (official TypeScript SDK) connected in-process with linked transports", "MCP servers over Streamable HTTP inside the bank's network"],
  ["Knowledge graph", "In-memory property graph with the Neo4j labels and relationships", "Neo4j, running the Golden Thread Cypher shown above"],
  ["Rule repository", "A real git repository (isomorphic-git) on an in-memory file system", "The bank's own Git server with protected main"],
  ["Sandbox SQL", "SQLite compiled to WebAssembly", "DuckDB or the bank's warehouse; the compiled SQL is portable"],
  ["Data", "Synthetic: 706 borrowers (146 in 48 connected groups, 560 stand-alone), 90 days, 63,540 daily rows, fixed seed 20261201", "The bank's data stays inside its boundary; agents see schemas and aggregates"],
  ["LLM", "Claude for the Extractor and Author when a key is configured; otherwise rule-based. The console shows which ran", "A private or on-premise model through the same interfaces"],
];

const CURL = String.raw`curl -s https://<this-site>/a2a/validator \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"SendMessage","params":{"message":{
    "messageId":"m1","role":"ROLE_USER",
    "parts":[{"data":{"skill":"validate-draft","input":{"yaml":
      "rule_id: SYN-EXP-012\nversion: 2\nstatus: draft\ntitle: Group exposure report\napplies_to: [UCB, NBFC-ML, NBFC-UL]\nwhen:\n  metric: group_exposure_pct_tier1\n  op: \">=\"\n  value: 12\n  unit: pct\naction: flag_for_report\nseverity: high\nsource:\n  circular: RBI-SYN-2026-017\n  clause: \"4(b)\"\n  obligation: OBL-017-4b\n  span: aggregate exposure exceeding 12 per cent of Tier 1 capital\n"}}}]}}}'

# result.task.status.state: "TASK_STATE_COMPLETED"
# reply: Objection OP-FIDELITY: expected op ">" because para 4(b) says "exceeding"
#        (strictly greater; equality does not trigger)`;

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} data-reveal className="scroll-mt-20 text-[clamp(28px,3vw,44px)]">
      {children}
    </h2>
  );
}

function Diagram() {
  const workers = AGENTS.filter((a) => a.id !== "conductor");
  return (
    <div data-ui className="bg-surface p-4 sm:p-6" role="img" aria-label="NIYAM architecture: inputs feed the Conductor and six agents over A2A; agents reach tools only through MCP servers; tools sit on the knowledge and data layer; humans approve before release">
      <div className="grid gap-2 sm:grid-cols-5">
        {["RBI circular", "Bank profile", "Internal policies", "Live rule repository", "Transaction history"].map((x) => (
          <div key={x} className="bg-bg px-3 py-2 text-center text-[13px] text-ink">
            {x}
          </div>
        ))}
      </div>
      <p className="my-2 text-center text-[12px] text-muted">read through MCP servers, never directly</p>
      <div className="grid gap-2 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col justify-center bg-navy p-4 text-on-navy">
          <p className="text-[16px] font-bold">Conductor</p>
          <p className="mt-1 text-[12.5px] text-on-navy-muted">Finds agents by Agent Card skills, delegates A2A tasks, caps objection rounds, stops at the human gate.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {workers.map((a) => (
            <div key={a.id} className={`p-3 ${a.id === "validator" ? "bg-bad-soft" : a.id === "release" ? "bg-ok-soft" : "bg-bg"}`}>
              <p className="text-[14px] font-semibold text-ink">{a.name}</p>
              <p className="text-[12px] text-muted">{a.role}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <p className="bg-bad-soft px-3 py-2 text-[12.5px] text-bad">A2A objection loop: Validator → Author, fix, re-test, at most 3 rounds, then a human</p>
        <p className="bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Human gate: two signatures over the exact files, then shadow → canary 10% → live, Sentinel rollback</p>
      </div>
      <p className="my-2 text-center text-[12px] text-muted">MCP tool calls, allowlisted per agent, checked by client and server</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {Object.keys(TOOL_GROUPS).map((g) => (
          <div key={g} className="bg-bg px-3 py-2 text-center text-[13px] font-semibold text-ink">
            {g}
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        {[
          ["Regulatory knowledge graph", "Circular → Clause → Obligation → Policy → Rule → Approval → Deployment"],
          ["Bank Semantic Model", "Business metrics mapped to the bank's columns"],
          ["Rule repository", "Git, draft/* branches, protected main"],
          ["Sandbox data", "Synthetic loan book, no PII to any model"],
        ].map(([t, d]) => (
          <div key={t} className="bg-navy-2 p-3 text-on-navy">
            <p className="text-[13.5px] font-semibold">{t}</p>
            <p className="text-[12px] text-on-navy-muted">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArchitecturePage() {
  const tools = Object.keys(TOOL_SERVER);
  return (
    <>
      <Nav />
      <main className="wrap">
        <header className="grid gap-8 pb-16 pt-20 lg:grid-cols-12 lg:pt-28">
          <h1 data-reveal className="text-[clamp(40px,5.4vw,88px)] lg:col-span-8">
            How NIYAM is built
          </h1>
          <p data-reveal style={{ ["--i" as string]: 1 }} className="text-[19px] text-ink lg:col-span-4 lg:self-end">
            Language work goes to agents. Arithmetic, tests, deployment and rollback go to deterministic code. Decisions go to people. Each boundary below is enforced in code, and each one can be inspected live.
          </p>
        </header>

        <section aria-label="System diagram" data-reveal>
          <Diagram />
        </section>

        <section className="pt-28" aria-labelledby="agents">
          <H2 id="agents">Seven agents, one job each</H2>
          <p data-reveal className="mt-4 max-w-[62ch] text-[18px]">
            Every agent publishes an A2A v1.0 Agent Card at its own well-known path and accepts JSON-RPC <code className="code">SendMessage</code>, <code className="code">GetTask</code> and{" "}
            <code className="code">CancelTask</code> (v0.3 method names are accepted too). The links below return the live cards from this deployment.
          </p>
          <div className="mt-10">
            {AGENTS.map((a, i) => (
              <article key={a.id} id={a.id} data-reveal className={`grid scroll-mt-20 gap-4 px-4 py-6 md:grid-cols-12 ${i % 2 ? "bg-bg" : "bg-surface"}`}>
                <div className="md:col-span-3">
                  <h3 className="text-[26px]">{a.name}</h3>
                  <p className="ui mt-1 text-[14px] text-muted">{a.role}</p>
                  <a href={`/a2a/${a.id}/.well-known/agent-card.json`} className="ui link mt-3 inline-block text-[13px]">
                    Agent Card
                  </a>
                </div>
                <div className="md:col-span-5">
                  <p className="text-[16px]">{a.summary}</p>
                  <p className="ui mt-2 text-[13px] text-muted">Model: {a.model}</p>
                </div>
                <div className="ui md:col-span-4">
                  <p className="text-[12.5px] text-muted">Skills</p>
                  <p className="text-[14px] text-ink">{a.skills.map((s) => s.id).join(", ")}</p>
                  <p className="mt-2 text-[12.5px] text-muted">MCP tools it may call</p>
                  <p className="code text-[12px] text-ink">{ALLOWLIST[a.id].join(", ")}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="pt-28" aria-labelledby="matrix">
          <H2 id="matrix">The allowlist, as a matrix</H2>
          <p data-reveal className="mt-4 max-w-[62ch] text-[18px]">
            Twenty-five tools across seven MCP servers. An agent's client refuses any tool outside its column, and each server checks the caller again. Only Release can touch deployment, and only with two valid signatures.
          </p>
          <div data-reveal className="mt-8 overflow-x-auto">
            <table className="ui w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-bg px-3 py-2 text-left font-semibold">Tool</th>
                  <th className="px-3 py-2 text-left font-normal text-muted">Server</th>
                  {AGENTS.map((a) => (
                    <th key={a.id} className="px-2 py-2 text-center font-semibold">
                      {a.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => (
                  <tr key={t} className="odd:bg-surface">
                    <td className="code sticky left-0 bg-inherit px-3 py-1.5">{t}</td>
                    <td className="px-3 py-1.5 text-muted">{TOOL_SERVER[t]}</td>
                    {AGENTS.map((a) => (
                      <td key={a.id} className="px-2 py-1.5 text-center">
                        {ALLOWLIST[a.id].includes(t) ? <span className="font-bold text-ok">✓</span> : <span className="text-surface-2">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-10 pt-28 lg:grid-cols-2" aria-labelledby="dsl">
          <div>
            <H2 id="dsl">Rules are data, then SQL</H2>
            <p data-reveal className="mt-4 max-w-[52ch] text-[18px]">
              A rule is typed YAML validated by a strict schema: unknown fields, metrics or operators are rejected. A deterministic compiler turns it into analytical SQL over the Bank Semantic Model, so no model ever writes executable code.
            </p>
            <div data-reveal className="mt-8 overflow-x-auto">
              <table className="ui w-full border-collapse text-[14px]">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-2 pr-3 font-normal">Clause says</th>
                    <th className="px-3 py-2 font-normal">Rule fires on</th>
                    <th className="py-2 pl-3 font-normal">Because</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARATORS.map(([w, op, why]) => (
                    <tr key={w} className="odd:bg-surface">
                      <td className="py-2 pl-2 pr-3">{w}</td>
                      <td className="code px-3 py-2 text-[15px] font-bold">{op}</td>
                      <td className="py-2 pl-3 text-muted">{why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div data-reveal className="grid gap-px bg-surface-2">
            <div className="bg-surface">
              <p className="ui px-4 pt-3 text-[12.5px] text-muted">draft/RBI-SYN-2026-017/SYN-EXP-012.yaml</p>
              <pre className="m-0 whitespace-pre-wrap p-4 text-[12.5px]">{FINAL_012}</pre>
            </div>
            <div className="bg-surface">
              <p className="ui px-4 pt-3 text-[12.5px] text-muted">Compiled</p>
              <pre className="m-0 whitespace-pre-wrap p-4 text-[12.5px]">{SNAPSHOT.sql}</pre>
            </div>
          </div>
        </section>

        <section className="grid gap-10 pt-28 lg:grid-cols-2" aria-labelledby="graph">
          <div>
            <H2 id="graph">The graph behind the Golden Thread</H2>
            <p data-reveal className="mt-4 max-w-[52ch] text-[18px]">
              Every agent writes to one regulatory knowledge graph. Clauses are contained by circulars, obligations derive from clauses, rules implement obligations, approvals sign rule versions and alerts are fired by them. Tracing an alert is one query.
            </p>
            <ol data-reveal className="ui mt-8 grid grid-cols-2 gap-2 p-0 text-[14px] sm:grid-cols-4">
              {["Regulator", "Circular", "Clause", "Obligation", "Policy", "Rule", "RuleVersion", "Approval", "Deployment", "Alert", "Metric", "BacktestRun"].map((n) => (
                <li key={n} className="list-none bg-surface px-3 py-2 font-semibold">
                  {n}
                </li>
              ))}
            </ol>
            <p data-reveal className="ui mt-3 text-[13px] text-muted">
              Relationships: ISSUED, AMENDS, CONTAINS, DERIVED_FROM, MAPPED_TO, IMPLEMENTED_BY, CONFLICTS_WITH, HAS_VERSION, IMPLEMENTS, TESTED_BY, APPROVED, DEPLOYED_AS, ROLLED_BACK_TO, FIRED_BY, MEASURES.
            </p>
          </div>
          <div data-reveal className="bg-navy p-5 text-on-navy">
            <p className="ui text-[12.5px] text-on-navy-muted">Golden Thread, as Cypher for the Neo4j deployment</p>
            <pre className="m-0 mt-3 whitespace-pre-wrap text-[12.5px] text-on-navy">{GOLDEN_THREAD_CYPHER}</pre>
          </div>
        </section>

        <section className="pt-28" aria-labelledby="coverage">
          <H2 id="coverage">Every line of the problem statement, in code</H2>
          <p data-reveal className="mt-4 max-w-[62ch] text-[18px]">
            The use case lists a workflow, data sources, a stack and guardrails. Each item maps to a place in this repository you can open.
          </p>
          <div data-reveal className="mt-8 overflow-x-auto">
            <table className="ui w-full min-w-[720px] border-collapse text-[14px]">
              <tbody>
                {COVERAGE.map(([k, v, f]) => (
                  <tr key={k} className="odd:bg-surface">
                    <td className="w-[220px] px-3 py-2 font-semibold">{k}</td>
                    <td className="px-3 py-2">{v}</td>
                    <td className="px-3 py-2">
                      <a href={`${REPO_URL}/blob/main/${f}`} className="code link text-[12px]">
                        {f}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pt-28" aria-labelledby="try">
          <H2 id="try">Talk to an agent yourself</H2>
          <p data-reveal className="mt-4 max-w-[62ch] text-[18px]">
            Send the Validator a rule that copies the old <code className="code">&gt;=</code> operator and it objects. This is the public endpoint of this deployment.
          </p>
          <pre data-reveal className="mt-6 overflow-x-auto bg-navy p-5 text-[12.5px] text-on-navy">{CURL}</pre>
        </section>

        <section className="pt-28" aria-labelledby="honest">
          <H2 id="honest">What is real here, and what changes in a bank</H2>
          <div data-reveal className="mt-8 overflow-x-auto">
            <table className="ui w-full min-w-[760px] border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-3 py-2 font-normal">Part</th>
                  <th className="px-3 py-2 font-normal">In this deployment</th>
                  <th className="px-3 py-2 font-normal">In production</th>
                </tr>
              </thead>
              <tbody>
                {HONEST.map(([k, a, b]) => (
                  <tr key={k} className="align-top odd:bg-surface">
                    <td className="px-3 py-2 font-semibold">{k}</td>
                    <td className="px-3 py-2">{a}</td>
                    <td className="px-3 py-2 text-muted">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p data-reveal className="mt-8">
            <Link href="/console" className="btn">
              Run it now
            </Link>
          </p>
        </section>
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
