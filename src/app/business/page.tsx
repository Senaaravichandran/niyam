import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { Card, Flow, Next, PageHead, Section, Sources } from "@/components/story/Blocks";
import { VIRTUSA_FIT } from "@/content/jatayu";
import { FACTS } from "@/content/site";

export const metadata: Metadata = {
  title: "Business and target segment",
  description: "Who NIYAM is for, who buys it, what it saves, how it is sold and delivered, and why it fits Virtusa's BFSI practice.",
};

const SEGMENTS: { who: string; why: string; first?: boolean }[] = [
  { who: "Urban co-operative banks", why: "1,457 of them, the same regulatory load as large banks with very small compliance and IT teams, and most of RBI's penalties.", first: true },
  { who: "NBFCs, middle and upper layer", why: "9,291 NBFCs are registered with RBI; the larger ones carry bank-like concentration and capital rules.", first: true },
  { who: "Small finance and payments banks", why: "Fast-growing, digital-first, and short of regulatory-change staff." },
  { who: "Private and public sector banks", why: "Already run AML, fraud and limit engines. NIYAM becomes the layer that turns each circular into a tested change for those engines." },
  { who: "IT services firms", why: "Partners such as Virtusa deliver compliance programmes; NIYAM is an accelerator they bring to every BFSI client." },
];

const PEOPLE: [string, string, string][] = [
  ["Chief Compliance Officer", "Buyer and maker", "Owns regulatory change; signs as maker."],
  ["Chief Risk Officer, Head of IT Change", "Co-buyer and checker", "Owns limits and releases; signs as checker."],
  ["Compliance analysts", "Daily users", "Review clauses, obligations and policy redlines."],
  ["IT and rule-engine teams", "Daily users", "Review drafts and diffs; the bank's engine still executes the rule."],
  ["Internal audit and RBI inspectors", "Readers", "Use the Golden Thread and the audit pack."],
];

const VALUE: [string, string][] = [
  ["Months to minutes for the mechanical work", "Reading, scoping, mapping, drafting and testing run in one pass; people spend their time on review and approval."],
  ["Fewer wrong rules", "Exact quotes, typed rules, boundary tests and the Validator catch the errors that hand-offs introduce."],
  ["Lower penalty risk", "Changes land before the effective date, and Board-reporting duties become tracked controls."],
  ["Audit in one query", "Every alert traces to the approvers and the exact sentence in the circular."],
  ["Safe by design", "Shadow, then canary, then live; automatic rollback; two signatures bound to the exact file."],
];

export default function BusinessPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHead
          kicker="5 · Business and target segment"
          title="Who needs NIYAM, who buys it, and why"
          lede="Every regulated lender in India must turn the same circulars into working rules. The smaller the lender, the harder that is. That is where NIYAM starts."
        />

        <Section id="segments" title="Target segments" intro="Start where the pain is sharpest and the teams are smallest, then grow into large banks and service partners." tone="surface">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {SEGMENTS.map((s) => (
              <Card key={s.who} title={s.who} tone={s.first ? "accent" : "plain"} tag={s.first ? "First segment" : "Next"}>
                {s.why}
              </Card>
            ))}
          </div>
        </Section>

        <Section id="people" title="Who buys, who uses">
          <div className="overflow-x-auto" data-reveal>
            <table className="ui w-full min-w-[640px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="px-4 py-2 font-normal">Person</th>
                  <th className="px-4 py-2 font-normal">Role</th>
                  <th className="px-4 py-2 font-normal">What they do in NIYAM</th>
                </tr>
              </thead>
              <tbody>
                {PEOPLE.map(([p, r, d]) => (
                  <tr key={p} className="odd:bg-surface">
                    <td className="px-4 py-3 font-semibold text-ink">{p}</td>
                    <td className="px-4 py-3 text-ink">{r}</td>
                    <td className="px-4 py-3 text-ink">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="value" title="What it is worth to a bank" tone="surface">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {VALUE.map(([t, d]) => (
              <Card key={t} title={t}>
                {d}
              </Card>
            ))}
          </div>
          <p data-reveal className="mt-6 max-w-[70ch] text-[17px]">
            For scale: RBI imposed 353 penalties worth ₹54.78 crore in 2024-25, 264 of them on co-operative banks, and compliance officers report that fully implementing a regulatory change takes more than a year on average.
          </p>
        </Section>

        <Section id="model" title="Business model" intro="Priced per regulated entity, delivered with a partner.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card title="Subscription" tone="navy" tag="Recurring">
              An annual licence per regulated entity, tiered by size and licence type, covering the agents, rule language, approvals and monitoring.
            </Card>
            <Card title="Engine adapters" tag="One-time">
              One MCP adapter per rule engine the bank runs (AML, fraud, limits). Built once, reused across banks that run the same engine.
            </Card>
            <Card title="Onboarding" tag="Services">
              Mapping the Bank Semantic Model to the bank&apos;s tables and loading its live rules and policies. Delivered by a partner such as Virtusa.
            </Card>
            <Card title="Deployment choice" tag="Private by default">
              Runs inside the bank&apos;s boundary with a private or on-premise model; data never leaves the bank.
            </Card>
          </div>
        </Section>

        <Section id="gtm" title="Go to market" tone="surface">
          <Flow
            label="Go-to-market path"
            steps={[
              { title: "Read-only pilot", note: "one UCB or NBFC, no deployment", tone: "accent" },
              { title: "Measured results", note: "precision, analyst hours saved" },
              { title: "Live rollout", note: "shadow, canary, live in the pilot" },
              { title: "Segment rollout", note: "UCB and NBFC associations" },
              { title: "Large banks via Virtusa", note: "layer over existing engines", tone: "navy" },
            ]}
          />
        </Section>

        <Section id="virtusa" title="Why it fits Virtusa">
          <div className="grid gap-3 md:grid-cols-2">
            {VIRTUSA_FIT.map(([t, d]) => (
              <Card key={t} title={t}>
                {d}
              </Card>
            ))}
          </div>
        </Section>

        <Sources
          items={[
            { label: FACTS.ucbs.source, url: FACTS.ucbs.url, note: "1,457 urban co-operative banks" },
            { label: FACTS.nbfcs.source, url: FACTS.nbfcs.url, note: "9,291 registered NBFCs" },
            { label: FACTS.penalties.source, url: FACTS.penalties.url, note: "353 penalties, ₹54.78 crore" },
            { label: FACTS.changeTime.source, url: FACTS.changeTime.url, note: "Time to implement a regulatory change" },
            { label: "Banking in India: types of banks", url: "https://en.wikipedia.org/wiki/Banking_in_India" },
            { label: FACTS.freeAi.source, url: FACTS.freeAi.url, note: "RBI's framework for responsible AI" },
          ]}
        />
        <Next href="/market" label="Market size and future scope" text="How big is this, and where does it go next?" />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
