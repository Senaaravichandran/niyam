import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { Card, Flow, PageHead, Section, Sources } from "@/components/story/Blocks";
import { FACTS, TEAM } from "@/content/site";

export const metadata: Metadata = {
  title: "Product requirements document",
  description: "NIYAM PRD: problem, users, goals, requirements, user flow, architecture, metrics, risks and roadmap for the Regulatory Circular to Live Rule Engine.",
};

/** [id, requirement, how NIYAM meets it, status] */
const FUNCTIONAL: [string, string, string, "Built" | "Production design"][] = [
  ["FR-1", "Accept a regulatory circular as PDF, Word or text", "Reader intake: PDF text layer, .docx and plain text, reflowed into numbered paragraphs", "Built"],
  ["FR-2", "Read scanned or poor-quality PDFs", "OCR, with olmOCR for poor scans, in front of the same Reader", "Production design"],
  ["FR-3", "Decide which clauses bind this bank", "Reader scopes every clause against the bank's licence type, with a stated reason", "Built"],
  ["FR-4", "Extract each obligation with its number, operator and source words", "Extractor (rule-based or Claude); a quote must appear word for word in the clause or it is rejected", "Built"],
  ["FR-5", "Map obligations to the bank's live rules and internal policies", "Mapper walks the knowledge graph: modify, gap (new rule), policy conflict, manual control", "Built"],
  ["FR-6", "Draft executable rules, never raw SQL", "Author writes a typed rule file on a draft branch; schema and compiler check it; SQL is compiled by code and runs read-only", "Built"],
  ["FR-7", "Test every draft against the regulation, not against itself", "Validator generates boundary tests from the obligation and objects to the Author over A2A (at most 3 rounds)", "Built"],
  ["FR-8", "Show the impact before anyone signs", "90-day backtest, old rule against new, alerts, customers flagged and analyst hours; what-if threshold explorer", "Built"],
  ["FR-9", "Require two different people to approve", "Maker and checker sign with name, employee ID, reason and a four-point checklist; HMAC tokens bound to the exact file, valid 24 hours", "Built"],
  ["FR-10", "Never let AI change production directly", "Release verifies both signatures, then shadow (days 1-3), canary 10% (days 4-7), live; feature flags, not code pushes", "Built"],
  ["FR-11", "Detect drift and roll back automatically", "Sentinel compares daily alerts with the backtest band (mean ± 3 sd); outside it, flag off and git revert", "Built"],
  ["FR-12", "Explain any alert to an inspector", "Golden Thread: alert, rule version, approvers, obligation, clause, circular, in one query; tamper-evident audit pack", "Built"],
  ["FR-13", "Work for any bank, not one", "Four sample banks plus a bank the user defines; rules are written against a Bank Semantic Model, so onboarding is mapping", "Built"],
  ["FR-14", "Connect to the bank's real rule engines", "One MCP adapter per engine (AML, fraud, limits); Neo4j and a warehouse inside the bank's boundary", "Production design"],
];

const NONFUNCTIONAL: [string, string][] = [
  ["Security", "Agents reach tools only through MCP servers with per-agent allowlists, checked by client and server. Circular text is treated as untrusted data. SQL is read-only."],
  ["Integrity", "Approval tokens and the approval pack are HMAC-signed over the SHA-256 of each rule file and the circular. Any edit after signing is refused."],
  ["Auditability", "Every A2A message, MCP call, objection, approval and rollout day is recorded; every alert traces to its sentence."],
  ["Model independence", "Rule-based mode runs the whole pipeline with no LLM. Claude mode is optional and checked by the same gates."],
  ["Cost", "Rule-based runs cost nothing. A Claude run is about $0.03 to $0.05 (four calls), with a daily cap and per-address rate limits."],
  ["Privacy", "The demo uses only synthetic data. In production, data stays in the bank; agents see schemas and aggregates, and a private model can be used."],
  ["Explainability", "Plain-language captions for each step, rule diffs, generated tests and impact in words, for compliance staff, not only engineers."],
];

const RISKS: [string, string][] = [
  ["The model misreads a clause or invents a number", "Exact-quote check, typed schema, compiler, tests from the regulation, Validator objections, and two human signatures."],
  ["“Exceeding” versus “or more” is lost", "Comparator rules map each phrase to an operator; boundary tests fail if the operator is wrong."],
  ["A signed rule is edited before release", "Tokens cover the file's SHA-256; Release refuses (demonstrated by the tamper test)."],
  ["Bad data after go-live", "Shadow and canary first; the Sentinel rolls back automatically on drift (demonstrated with an injected duplicate feed)."],
  ["Prompt injection hidden in a circular", "The circular is handled as data; agents cannot call tools outside their allowlist."],
  ["Model outage or cost spike", "Rule-based mode, daily cap, rate limits."],
];

export default function PrdPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHead
          kicker="Product requirements document"
          title="NIYAM: Regulatory Circular to Live Rule Engine"
          lede={
            <>
              Version 1.0 · November 2026 · {TEAM.name}. A product requirements document for the prototype at{" "}
              <Link href="/console" className="link">
                niyam-virtusa.vercel.app/console
              </Link>
              .
            </>
          }
        />

        <Section id="summary" title="1. Summary" tone="surface">
          <p data-reveal className="max-w-[75ch] text-[18px] leading-[1.6]">
            When the Reserve Bank of India issues a circular, every bank it applies to must find it, work out what it means for its own rules and policies, change live systems safely, and prove it later. Today that takes weeks to months of hand-offs between compliance, risk, IT and testing. NIYAM is a team of seven AI agents that turns a circular into a <b>tested, two-person-approved, monitored live rule</b>, rolls it out safely, rolls it back on drift, and traces every alert to the sentence that caused it.
          </p>
        </Section>

        <Section id="problem" title="2. Problem">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card title="Constant change">In November 2025 RBI folded about 9,000 circulars into 244 Master Directions that now change by amendment.</Card>
            <Card title="Slow and manual">Fully implementing a regulatory change takes more than a year on average, by compliance officers&apos; own account.</Card>
            <Card title="Costly when wrong" tone="bad">
              RBI imposed 353 penalties worth ₹54.78 crore in 2024-25; 264 fell on co-operative banks.
            </Card>
            <Card title="Tools stop early">Existing RegTech tells a bank what changed. None writes, tests, approves and deploys the rule itself.</Card>
          </div>
        </Section>

        <Section id="users" title="3. Users" tone="surface">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <Card title="Chief Compliance Officer" tag="Maker">Reviews and prepares each change; signs first.</Card>
            <Card title="Head of Risk and IT Change" tag="Checker">Independently authorises the change for release.</Card>
            <Card title="Compliance analyst" tag="Daily user">Reviews clauses, obligations and policy conflicts.</Card>
            <Card title="Rule-engine engineer" tag="Daily user">Reviews rule diffs, tests and rollout.</Card>
            <Card title="Auditor or RBI inspector" tag="Reader">Asks why an alert fired; reads the Golden Thread.</Card>
          </div>
          <p data-reveal className="mt-6 max-w-[75ch] text-[17px]">
            First segment: the 1,457 urban co-operative banks and larger NBFCs, which carry the same rules as large banks with very small teams. Next: large banks, as a layer over the engines they already run.
          </p>
        </Section>

        <Section id="goals" title="4. Goals and non-goals">
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Goals" tone="ok">
              <ul className="m-0 list-disc space-y-1 pl-5">
                <li>Circular to signed approval pack in minutes, not months</li>
                <li>Zero rules that do not match the regulation&apos;s number, operator and scope</li>
                <li>No production change without two human signatures</li>
                <li>Automatic, logged rollback on abnormal behaviour</li>
                <li>Every alert traceable to its clause, 100% of the time</li>
              </ul>
            </Card>
            <Card title="Non-goals">
              <ul className="m-0 list-disc space-y-1 pl-5">
                <li>Replacing the bank&apos;s rule engines; NIYAM writes rules for them</li>
                <li>Removing human judgement from approval</li>
                <li>Legal interpretation of ambiguous regulation; those clauses become manual controls</li>
                <li>Handling real customer data in this prototype</li>
              </ul>
            </Card>
          </div>
        </Section>

        <Section id="flow" title="5. User flow" tone="surface">
          <Flow
            label="NIYAM user flow"
            steps={[
              { title: "Choose a bank", note: "or define your own" },
              { title: "Load the circular", note: "PDF, Word or text" },
              { title: "Run", note: "rule-based or Claude", tone: "navy" },
              { title: "Watch 7 agents", note: "read, extract, map, draft, test" },
              { title: "Two signatures", note: "maker and checker", tone: "warn" },
              { title: "Release", note: "shadow, canary, live", tone: "accent" },
              { title: "Bank site", note: "live rollout, Sentinel, Golden Thread", tone: "ok" },
            ]}
          />
        </Section>

        <Section id="functional" title="6. Functional requirements">
          <div className="overflow-x-auto" data-reveal>
            <table className="ui w-full min-w-[860px] border-collapse text-[14.5px]">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="px-3 py-2 font-normal">ID</th>
                  <th className="px-3 py-2 font-normal">Requirement</th>
                  <th className="px-3 py-2 font-normal">How NIYAM meets it</th>
                  <th className="px-3 py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {FUNCTIONAL.map(([id, req, how, status]) => (
                  <tr key={id} className="align-top odd:bg-surface">
                    <td className="px-3 py-2.5 font-semibold text-ink">{id}</td>
                    <td className="px-3 py-2.5 text-ink">{req}</td>
                    <td className="px-3 py-2.5 text-ink">{how}</td>
                    <td className={`whitespace-nowrap px-3 py-2.5 font-semibold ${status === "Built" ? "text-ok" : "text-warn"}`}>{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="nfr" title="7. Non-functional requirements" tone="surface">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {NONFUNCTIONAL.map(([t, d]) => (
              <Card key={t} title={t}>
                {d}
              </Card>
            ))}
          </div>
        </Section>

        <Section id="arch" title="8. Architecture">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Card title="Seven agents over A2A" tone="navy">Conductor, Reader, Extractor, Mapper, Author, Validator, Release. Found by Agent Cards; JSON-RPC tasks.</Card>
            <Card title="Seven MCP tool servers">Knowledge graph, semantic model, rule compiler, backtest, git, approvals, deploy-monitor; allowlisted per agent.</Card>
            <Card title="Knowledge graph and semantic model">Circular to clause to obligation to rule to approval to alert; business terms mapped to the bank&apos;s columns.</Card>
            <Card title="Typed rule language">Strict schema, compiled to read-only SQL by code.</Card>
            <Card title="Stack">Next.js on Vercel, TypeScript, official MCP SDK, SQLite (WebAssembly) sandbox, isomorphic-git, Claude via the Anthropic API.</Card>
            <Card title="Bank sites">Each bank has its own rule-engine site that receives the rollout live from the console.</Card>
          </div>
          <p data-reveal className="mt-4 text-[16px]">
            Full detail:{" "}
            <Link href="/architecture" className="link">
              Architecture
            </Link>{" "}
            and{" "}
            <Link href="/solution" className="link">
              Our solution
            </Link>
            .
          </p>
        </Section>

        <Section id="metrics" title="9. Success metrics" tone="surface">
          <div className="overflow-x-auto" data-reveal>
            <table className="ui w-full min-w-[640px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="px-3 py-2 font-normal">Metric</th>
                  <th className="px-3 py-2 font-normal">Target</th>
                  <th className="px-3 py-2 font-normal">How it is measured</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Circular to signed approval pack", "Under 1 hour (today: weeks)", "Run timestamps in the console"],
                  ["Generated tests passing at approval", "100%", "Validator results in every pack"],
                  ["Obligations with a verified exact quote", "100%; unverified ones rejected", "Extractor span check"],
                  ["Extraction precision on labelled clauses", "Reported live, failures included", "Scorecard on the Research page (30 hand-labelled clauses, 10 broken rules)"],
                  ["Unauthorised production changes", "Zero", "Release refuses without two valid tokens"],
                  ["Time to roll back on drift", "Same day, automatic", "Sentinel and rollback log"],
                  ["Alerts traceable to their clause", "100%", "Golden Thread for any alert"],
                  ["Pilot: analyst hours saved per change", "To be measured", "Read-only pilot with one co-operative bank or NBFC"],
                ].map(([m, t, h]) => (
                  <tr key={m} className="align-top odd:bg-bg">
                    <td className="px-3 py-2.5 font-semibold text-ink">{m}</td>
                    <td className="px-3 py-2.5 text-ink">{t}</td>
                    <td className="px-3 py-2.5 text-muted">{h}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="risks" title="10. Risks and mitigations">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {RISKS.map(([r, m]) => (
              <Card key={r} title={r} tone="plain">
                {m}
              </Card>
            ))}
          </div>
        </Section>

        <Section id="roadmap" title="11. Release plan" tone="surface">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <Card title="Now: prototype" tone="accent">Everything marked Built above, on synthetic data, deployed.</Card>
            <Card title="0-3 months: read-only pilot">One co-operative bank or NBFC; obligation register and impact reports only.</Card>
            <Card title="3-6 months: connectors">MCP adapters for AML, fraud and limit engines; Neo4j in the bank; private model.</Card>
            <Card title="6-12 months: Master Directions">Track every amendment to the 244 Master Directions as a diff.</Card>
            <Card title="12-24 months: more regulators">SEBI and IRDAI; only the Reader and semantic model change.</Card>
          </div>
        </Section>

        <Section id="demo" title="12. How to evaluate the prototype in 3 minutes">
          <ol className="m-0 grid gap-2 p-0">
            {[
              <>
                Open{" "}
                <Link href="/console" className="link">
                  the console
                </Link>
                , pick ABC Bank (its circular PDF loads and is read automatically), or add your own bank.
              </>,
              "Press Run the pipeline. Watch the seven agents; each card says what it produced and how.",
              "In Two-person approval, sign as maker and checker (names, IDs, reasons, checklist).",
              "Press Release. The bank's own site opens and plays shadow, canary and live, the Sentinel's rollback, and the Golden Thread.",
              "Optional: switch to Claude live to see Claude's calls stream, with tokens and cost, checked by the same gates.",
            ].map((step, i) => (
              <li key={i} className="grid list-none grid-cols-[40px_1fr] items-start bg-surface p-4 text-[16px]">
                <span className="ui num text-[22px] font-bold text-accent">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Sources
          items={[
            { label: FACTS.masterDirections.source, url: FACTS.masterDirections.url, note: "244 Master Directions" },
            { label: FACTS.penalties.source, url: FACTS.penalties.url, note: "RBI penalties 2024-25" },
            { label: FACTS.changeTime.source, url: FACTS.changeTime.url, note: "Time to implement a regulatory change" },
            { label: FACTS.ucbs.source, url: FACTS.ucbs.url, note: "Urban co-operative banks" },
            { label: FACTS.freeAi.source, url: FACTS.freeAi.url, note: "RBI FREE-AI framework" },
            { label: "A2A Protocol specification", url: "https://a2a-protocol.org/latest/specification/" },
            { label: "Model Context Protocol specification", url: "https://modelcontextprotocol.io/specification/2025-06-18" },
          ]}
        />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
