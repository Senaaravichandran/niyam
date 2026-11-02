import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { Card, Next, PageHead, Section, Sources } from "@/components/story/Blocks";
import { ROADMAP } from "@/content/research";
import { FACTS } from "@/content/site";

export const metadata: Metadata = {
  title: "Market size and future scope",
  description: "The RegTech market NIYAM sits in, the regulated entities in India that need it, and the roadmap from proof of concept to every regulator.",
};

const NUMBERS: { figure: string; label: string; fact: keyof typeof FACTS }[] = [
  { figure: "$15-19 bn", label: "global RegTech market in 2025 (US dollars), growing 17 to 21% a year", fact: "regtech" },
  { figure: "244", label: "RBI Master Directions that now change by amendment", fact: "masterDirections" },
  { figure: "10,748", label: "urban co-operative banks (1,457) and NBFCs (9,291) that must apply them", fact: "ucbs" },
  { figure: "₹54.78 cr", label: "in RBI penalties across 353 actions in 2024-25", fact: "penalties" },
];

const SCOPE: [string, string, string][] = [
  ["More rule types", "AML scenarios, KYC refresh, fraud patterns and liquidity ratios", "Add metrics to the semantic model; the agents and release path stay the same."],
  ["More Indian regulators", "SEBI, IRDAI, PFRDA", "Only the Reader's segmenter and the semantic model change."],
  ["Other countries", "Basel-style frameworks, MAS, FCA, EBA", "The rule language and two-person release are regulator-neutral."],
  ["Master Direction tracking", "Every amendment as a diff", "The knowledge graph keeps each paragraph's history and the rules that implement it."],
  ["Inside the bank", "Neo4j, DuckDB, private models", "The demo's in-memory graph and SQLite sandbox swap for production stores through the same interfaces."],
  ["Responsible AI", "RBI FREE-AI sutras", "Human approval, exact quotes, tests and the Golden Thread map to accountability and explainability."],
];

export default function MarketPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHead
          kicker="6 · Market size and future scope"
          title="A large, growing market with a step nobody automates"
          lede="Regulatory technology is already a multi-billion-dollar market. Existing tools stop at telling a bank what changed. NIYAM takes the last step: a tested, approved, monitored live rule."
        />

        <section className="bg-navy py-20 text-on-navy" aria-labelledby="numbers">
          <div className="wrap">
            <h2 id="numbers" data-reveal className="text-[clamp(26px,2.8vw,40px)] text-on-navy">
              The numbers
            </h2>
            <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {NUMBERS.map((n, i) => (
                <div key={n.figure} data-reveal style={{ ["--i" as string]: i }}>
                  <p className="ui num text-[clamp(40px,4.4vw,68px)] font-bold leading-none tracking-[-0.04em]">{n.figure}</p>
                  <p className="mt-3 text-[16.5px] text-on-navy">{n.label}</p>
                  <a href={FACTS[n.fact].url} target="_blank" rel="noreferrer" className="ui link mt-2 inline-block text-[13px] text-on-navy-muted">
                    {FACTS[n.fact].source}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Section id="where" title="Where NIYAM sits in the market" tone="surface">
          <div className="grid gap-3 md:grid-cols-3">
            <Card title="Horizon scanning" tag="Crowded">
              Tools that alert a bank to new regulation. Many vendors.
            </Card>
            <Card title="Obligation and control mapping" tag="Crowded">
              Registers that link obligations to policies and controls.
            </Card>
            <Card title="Circular to live rule" tag="Open" tone="accent">
              Drafting, testing, approving, rolling out and monitoring the executable rule, traced to its clause. This is NIYAM.
            </Card>
          </div>
          <p data-reveal className="mt-6 max-w-[70ch] text-[17px]">
            The first market is Indian lenders with small compliance teams. Each of the 10,748 urban co-operative banks and NBFCs counted above must turn the same RBI amendments into working controls.
          </p>
        </Section>

        <Section id="scope" title="Future scope" intro="The architecture was built so that growth means adding data and adapters, not rewriting agents.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {SCOPE.map(([t, what, how]) => (
              <Card key={t} title={t} tag={what}>
                {how}
              </Card>
            ))}
          </div>
        </Section>

        <section className="bg-navy py-20 text-on-navy" aria-labelledby="roadmap">
          <div className="wrap">
            <h2 id="roadmap" data-reveal className="text-[clamp(26px,2.8vw,40px)] text-on-navy">
              Roadmap
            </h2>
            <ol className="m-0 mt-10 grid gap-px p-0 md:grid-cols-5">
              {ROADMAP.map(([when, what, detail], i) => (
                <li key={when} data-reveal style={{ ["--i" as string]: i }} className={`list-none p-5 ${i === 0 ? "bg-accent" : "bg-navy-2"}`}>
                  <p className="ui text-[13px] text-on-navy-muted">{when}</p>
                  <p className="ui mt-1 text-[19px] font-semibold leading-tight">{what}</p>
                  <p className="mt-3 text-[15px] text-on-navy">{detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Sources
          items={[
            { label: FACTS.regtech.source, url: FACTS.regtech.url, note: "RegTech market size and growth" },
            { label: FACTS.masterDirections.source, url: FACTS.masterDirections.url, note: "244 Master Directions" },
            { label: FACTS.ucbs.source, url: FACTS.ucbs.url, note: "1,457 urban co-operative banks" },
            { label: FACTS.nbfcs.source, url: FACTS.nbfcs.url, note: "9,291 registered NBFCs" },
            { label: FACTS.penalties.source, url: FACTS.penalties.url, note: "RBI penalties in 2024-25" },
            { label: FACTS.freeAi.source, url: FACTS.freeAi.url, note: "RBI FREE-AI framework" },
          ]}
        />
        <Next href="/research" label="Research" text="Every figure here is sourced. See the research behind the design." />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
