import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { Card, Next, PageHead, Section, Sources } from "@/components/story/Blocks";
import { FACTS } from "@/content/site";

export const metadata: Metadata = {
  title: "Existing solution",
  description: "What happens inside a bank today after an RBI circular arrives: eleven manual steps across compliance, risk, IT and testing, taking one to six months.",
};

const BANK: [string, string][] = [
  ["200+", "branches"],
  ["5 lakh", "customers"],
  ["1 lakh", "active loans"],
  ["Thousands", "of payments every hour"],
];

const TEAMS = ["Compliance", "Risk management", "Legal", "IT and core banking", "Testing and QA", "Operations", "Board and senior management"];

/** [step, who, what happens, what comes out] */
const STEPS: [string, string, string, string][] = [
  ["Regulatory monitoring and intake", "Compliance", "Someone notices RBI has published a new circular and logs its ID, title, rules and deadline. The hard part: spotting exactly what changed.", "Circular register entry"],
  ["Applicability assessment", "Compliance", "Does it apply to us? Checked against the bank's licence type, products and existing policies.", "Applies / does not apply, with reasons"],
  ["Obligation extraction", "Compliance, Legal", "Each paragraph is turned into a plain obligation: who must do what, by when, with which number.", "Obligation list"],
  ["Policy mapping and impact", "Compliance, Risk", "Which internal policies and systems are affected: loan system, risk engine, AML, reports. Gaps and conflicts are found and policies are rewritten.", "Impact assessment, policy updates"],
  ["IT handover", "Compliance to IT", "The change is written up as a requirement document, a Jira ticket or a change request: what to change and how it should behave.", "Change request"],
  ["Rule development", "IT", "Developers change the rule in the loan, risk or monitoring system.", "Code or configuration change"],
  ["Testing and UAT", "Testing, business users", "QA tests it, then business users run user acceptance testing (UAT) and sign off.", "UAT sign-off"],
  ["Backtesting and impact analysis", "Risk, IT", "The new rule is run on historical data: how many alerts, which customers, how much extra work.", "Impact report"],
  ["Approval and change governance", "Change board, senior management", "A maker prepares the change and a checker authorises it; a change advisory board approves the release.", "Signed approval"],
  ["Production deployment", "IT operations", "The change is released into live systems, often in a weekend window.", "Live rule"],
  ["Monitoring and rollback", "IT, Risk", "Alerts and errors are watched. If something goes wrong, the change is rolled back by hand.", "Incident or steady state"],
];

export default function ExistingPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHead
          kicker="2 · Existing solution"
          title="How a bank does it today"
          lede="Take ABC Bank, a typical mid-sized Indian bank. A new RBI circular has just been published. Here is what happens next."
        />

        <Section id="abc" title="Meet ABC Bank" tone="surface">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BANK.map(([n, l]) => (
              <div key={l} data-reveal className="bg-navy p-5 text-on-navy">
                <p className="ui num text-[clamp(36px,4vw,56px)] font-bold leading-none tracking-[-0.03em]">{n}</p>
                <p className="mt-2 text-[16px] text-on-navy">{l}</p>
              </div>
            ))}
          </div>
          <p data-reveal className="ui mt-6 text-[15px] text-muted">
            Teams that must work together:
          </p>
          <ul className="m-0 mt-2 flex flex-wrap gap-2 p-0">
            {TEAMS.map((t) => (
              <li key={t} data-reveal className="ui list-none bg-bg px-3 py-1.5 text-[14.5px] text-ink">
                {t}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="steps" title="Eleven steps, many hand-offs" intro="Every step is done by people, passing documents from one team to the next.">
          <ol className="m-0 grid gap-2 p-0">
            {STEPS.map(([step, who, what, out], i) => (
              <li key={step} data-reveal style={{ ["--i" as string]: i % 4 }} className="grid list-none gap-3 bg-surface p-5 md:grid-cols-[56px_1.1fr_2fr_1fr] md:items-start">
                <span className="ui num text-[28px] font-bold leading-none text-accent">{i + 1}</span>
                <div>
                  <h3 className="ui text-[17px] font-semibold leading-snug text-ink">{step}</h3>
                  <p className="ui mt-1 text-[13.5px] text-muted">{who}</p>
                </div>
                <p className="text-[15.5px] leading-[1.55] text-ink">{what}</p>
                <p className="ui text-[14px] text-ink">
                  <span className="block text-[12px] uppercase tracking-[0.06em] text-muted">Output</span>
                  {out}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="cost" title="What it costs" tone="surface">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Card title="1 to 6 months per change" tone="warn">
              Depending on how risky and critical the change is. For a full regulatory programme, compliance officers report more than a year on average.
            </Card>
            <Card title="Meaning gets lost in hand-offs" tone="bad">
              “Exceeding 25%” becomes “25% or more” somewhere between the circular, the ticket and the code.
            </Card>
            <Card title="Deadlines slip" tone="bad">
              Every step waits for the one before it. A late rule is a breach, and breaches are penalised.
            </Card>
            <Card title="No trace back" tone="plain">
              When an inspector asks why an alert fired, the answer is spread across emails, tickets and code.
            </Card>
            <Card title="Testing is thin" tone="plain">
              Boundary cases (exactly on the limit, just above it) are easy to miss by hand.
            </Card>
            <Card title="Rollback is manual" tone="plain">
              If live data behaves strangely, someone has to notice it and undo the change.
            </Card>
          </div>
          <p data-reveal className="mt-8 max-w-[70ch] text-[18px]">
            The goal never changes: find the rule exactly, implement it correctly, and deploy it before the deadline. NIYAM keeps all eleven steps but runs the mechanical ones with agents, and keeps humans where they matter.
          </p>
        </Section>

        <Sources
          items={[
            { label: FACTS.changeTime.source, url: FACTS.changeTime.url, note: "Time to fully implement a regulatory change" },
            { label: FACTS.penalties.source, url: FACTS.penalties.url, note: "Penalties for non-compliance" },
            { label: "Acceptance testing (UAT)", url: "https://en.wikipedia.org/wiki/Acceptance_testing" },
            { label: "Maker-checker control", url: "https://en.wikipedia.org/wiki/Maker-checker" },
            { label: FACTS.regtech.source, url: FACTS.regtech.url, note: "The RegTech market" },
            { label: "RBI Master Directions", url: "https://www.rbi.org.in/Scripts/BS_ViewMasterDirections.aspx" },
          ]}
        />
        <Next href="/solution" label="Our solution" text="NIYAM runs the same eleven steps in minutes, with two humans signing before anything goes live." />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
