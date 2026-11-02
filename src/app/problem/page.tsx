import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { Card, Flow, Next, PageHead, Section, Sources } from "@/components/story/Blocks";
import { FACTS } from "@/content/site";

export const metadata: Metadata = {
  title: "The problem",
  description: "RBI changes a rule; every bank it regulates must find it, understand it, and change live systems safely before the deadline. Who is involved, what a circular contains, and why it is hard.",
};

const RBI_ROLES: [string, string][] = [
  ["Monetary authority", "Sets the repo rate and steers inflation."],
  ["Regulator and supervisor", "Writes the rules for banks and NBFCs, inspects them, and penalises breaches."],
  ["Payment systems", "Runs and oversees UPI, NEFT, RTGS and card networks."],
  ["Currency and foreign exchange", "Issues the rupee and manages foreign exchange."],
];

const BANKS: [string, string, string][] = [
  ["Public sector banks", "Government-owned", "SBI, Bank of Baroda, Punjab National Bank, Canara Bank"],
  ["Private sector banks", "Privately owned", "HDFC Bank, ICICI Bank, Axis Bank, Kotak Mahindra Bank"],
  ["Small finance banks", "Small borrowers, unbanked areas", "AU, Equitas, Ujjivan"],
  ["Payments banks", "Deposits and payments, no lending", "Airtel Payments Bank, India Post Payments Bank, Fino"],
  ["Co-operative banks", "Member-owned, local", "1,457 urban co-operative banks (March 2025), plus state and district banks"],
  ["Regional rural banks", "Rural credit, sponsored by a bank", "Merged in 2025 under One State, One RRB"],
  ["Foreign banks", "Branches of global banks", "HSBC, Standard Chartered, Deutsche Bank"],
  ["NBFCs", "Lenders that are not banks", "9,291 registered with RBI (December 2024)"],
];

const AREAS: [string, string][] = [
  ["Credit exposure", "How much a bank may lend to one borrower or one group, as % of capital"],
  ["KYC and AML", "Who must be verified, how often, and which transactions to report"],
  ["Fraud prevention", "Which patterns to flag and how fast to report them"],
  ["Loans and interest", "Pricing, provisioning, restructuring, digital lending"],
  ["Capital and liquidity", "Minimum ratios the bank must hold every day"],
  ["Reporting", "Which returns go to RBI or the Board, and by when"],
];

const ANATOMY: [string, string][] = [
  ["Reference number", "RBI/2025-26/45"],
  ["Department reference", "DOR.CRE.REC.17/13.03.000/2025-26"],
  ["Date", "The day it is issued"],
  ["Addressed to", "“All Primary (Urban) Co-operative Banks”: decides who it binds"],
  ["Title", "The subject, for example Large Exposures"],
  ["Body", "Numbered paragraphs: what is new, changed, clarified or withdrawn"],
  ["Deadline", "Effective date; sometimes a different date per bank type"],
  ["Annexes", "Tables, formats and definitions"],
];

export default function ProblemPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHead
          kicker="1 · The problem"
          title="RBI changes a rule. Every bank must follow it, correctly and on time."
          lede="A circular is written for people. A bank runs on systems. Between the two sits weeks of reading, meetings, tickets and testing, and a fine if the bank gets it wrong or late."
        />

        <Section id="ecosystem" title="Who is involved" intro="RBI is the Reserve Bank of India, the country's central bank, set up in 1935. It regulates every bank and NBFC in India." tone="surface">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {RBI_ROLES.map(([t, d]) => (
              <Card key={t} title={t} tone="navy" tag="RBI">
                {d}
              </Card>
            ))}
          </div>
          <h3 data-reveal className="mt-12 text-[22px]">
            The banks it regulates
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {BANKS.map(([t, what, eg]) => (
              <Card key={t} title={t} tag={what}>
                <span className="text-muted">{eg}</span>
              </Card>
            ))}
          </div>
          <p data-reveal className="mt-8 max-w-[70ch] text-[17px]">
            Inside every one of them: customers and their transactions, internal policies, risk-management rules, reporting systems, compliance officers, IT teams and testing teams. A new circular can touch all of them.
          </p>
        </Section>

        <Section id="areas" title="What a circular changes" intro="Many circulars carry something a system can check: a limit, a ratio, a deadline, a count.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {AREAS.map(([t, d]) => (
              <Card key={t} title={t}>
                {d}
              </Card>
            ))}
          </div>
        </Section>

        <Section id="anatomy" title="What a circular looks like" tone="surface" intro="RBI publishes each circular on rbi.org.in as a web page and a PDF. Every one has the same parts.">
          <div className="grid gap-8 lg:grid-cols-12">
            <dl data-reveal className="m-0 grid gap-px bg-surface-2 lg:col-span-7">
              {ANATOMY.map(([k, v]) => (
                <div key={k} className="grid gap-1 bg-bg px-5 py-3 sm:grid-cols-[200px_1fr]">
                  <dt className="ui text-[15px] font-semibold text-ink">{k}</dt>
                  <dd className="m-0 text-[15px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-3 lg:col-span-5">
              <Card title="Four kinds of change" tone="accent">
                <b>New</b> instruction · <b>Amended</b> limit or rule · <b>Clarified</b> meaning · <b>Withdrawn</b> rule
              </Card>
              <Card title="Nobody sends it to you" tone="warn">
                RBI addresses a circular to a category of banks and publishes it. It does not email each bank. Every bank must watch for it, usually through an internal regulatory alert system, and decide whether it applies.
              </Card>
            </div>
          </div>
        </Section>

        <Section id="master" title="Master Directions: the combined rulebook" intro="Over the years RBI may issue ten circulars about loans. A Master Direction folds them into one rulebook for that subject, kept up to date.">
          <Flow
            label="Many circulars become one Master Direction, then each new circular amends it"
            steps={[
              { title: "10 loan circulars", note: "issued over years" },
              { title: "1 Master Direction", note: "the combined rulebook", tone: "navy" },
              { title: "New circular", note: "amends some paragraphs", tone: "accent" },
              { title: "Bank must find", note: "which category, which paragraphs, what no longer applies", tone: "warn" },
            ]}
          />
          <p data-reveal className="mt-8 max-w-[70ch] text-[17px]">
            In November 2025 RBI folded about 9,000 circulars into 244 Master Directions. The rulebook is now a set of living documents that change by amendment, and each amendment must reach the bank&apos;s systems.
          </p>
        </Section>

        <Section id="hard" title="Why a bank cannot just plug it in" tone="surface" intro="The bank has to understand, identify and deploy the change safely. Each step has a trap.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Card title="Find the change" tone="plain">
              Spot the circular, then the changed rules and deadlines inside it.
            </Card>
            <Card title="Does it apply to us?" tone="plain">
              The same circular may bind urban co-operative banks but not NBFCs.
            </Card>
            <Card title="Words decide the number" tone="plain">
              “Exceeding 25 per cent” is not “25 per cent or more”. One word changes which loans are breaches.
            </Card>
            <Card title="Internal policy may disagree" tone="plain">
              The bank&apos;s own policy may still allow what the circular now forbids.
            </Card>
            <Card title="Live systems, real money" tone="bad">
              A wrong rule blocks good loans or misses bad ones. It must be tested before it goes live.
            </Card>
            <Card title="Prove it later" tone="bad">
              Inspectors ask why an alert fired, or why it did not. In 2024-25 RBI imposed 353 penalties, 264 of them on co-operative banks.
            </Card>
          </div>
        </Section>

        <Sources
          items={[
            { label: "Reserve Bank of India: About us", url: "https://www.rbi.org.in/commonman/English/Scripts/AboutUs.aspx" },
            { label: "Reserve Bank of India (overview and functions)", url: "https://en.wikipedia.org/wiki/Reserve_Bank_of_India" },
            { label: "Banking in India: types of banks", url: "https://en.wikipedia.org/wiki/Banking_in_India" },
            { label: "RBI Notifications (where circulars are published)", url: "https://www.rbi.org.in/Scripts/NotificationUser.aspx" },
            { label: "RBI Master Directions", url: "https://www.rbi.org.in/Scripts/BS_ViewMasterDirections.aspx" },
            { label: FACTS.masterDirections.source, url: FACTS.masterDirections.url, note: "About 9,000 circulars consolidated into 244 Master Directions" },
            { label: FACTS.penalties.source, url: FACTS.penalties.url, note: "353 penalties in 2024-25" },
            { label: FACTS.ucbs.source, url: FACTS.ucbs.url, note: "1,457 urban co-operative banks" },
            { label: FACTS.nbfcs.source, url: FACTS.nbfcs.url, note: "Registered NBFCs" },
            { label: "RBI/2019-20/171: Exposure norms for UCBs (a real example)", url: FACTS.ucbLimits.url },
          ]}
        />
        <Next href="/existing" label="How banks do it today" text="So what happens inside a bank when a circular lands today?" />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
