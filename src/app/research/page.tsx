import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { COMPETITORS, PAPERS, QA, ROADMAP, SUTRAS } from "@/content/research";
import { Scorecard } from "@/components/eval/Scorecard";
import { FACTS, PICTURES, TEAM } from "@/content/site";

export const metadata: Metadata = {
  title: "Research",
  description: "The problem NIYAM solves, with sources: RBI's consolidation into 244 Master Directions, penalties on co-operative banks, where existing RegTech stops, the research behind the design, and RBI FREE-AI alignment.",
};

const NUMBERS: { figure: string; label: string; fact: keyof typeof FACTS }[] = [
  { figure: "244", label: "Master Directions replacing about 9,000 circulars, November 2025", fact: "masterDirections" },
  { figure: "353", label: "RBI penalties in 2024-25, worth ₹54.78 crore; 264 on co-operative banks", fact: "penalties" },
  { figure: "1,457", label: "urban co-operative banks at the end of March 2025", fact: "ucbs" },
  { figure: "9,291", label: "NBFCs registered with RBI, 31 December 2024", fact: "nbfcs" },
];

function H2({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} data-reveal className="text-[clamp(28px,3vw,44px)]">
      {children}
    </h2>
  );
}

export default function ResearchPage() {
  return (
    <>
      <Nav />
      <main>
        <header className="wrap grid gap-10 pb-20 pt-20 lg:grid-cols-12 lg:pt-28">
          <div className="lg:col-span-7">
            <h1 data-reveal className="text-[clamp(40px,5.4vw,88px)]">
              Why this problem, why now
            </h1>
            <p data-reveal style={{ ["--i" as string]: 1 }} className="mt-8 max-w-[52ch] text-[20px] leading-[1.5]">
              RBI has turned its rulebook into 244 living documents that change by amendment. Banks still turn each amendment into system rules by hand. This page is the research behind NIYAM, every figure with its source.
            </p>
          </div>
          <figure data-reveal style={{ ["--i" as string]: 2 }} className="m-0 lg:col-span-5">
            <div className="relative aspect-square overflow-hidden bg-navy">
              <Image src={PICTURES.coins.src} alt={PICTURES.coins.alt} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="slow-drift object-cover" />
            </div>
            <figcaption className="ui mt-2 text-[13px] text-muted">The rupee coins in every co-operative bank's vault fall under the same Master Directions as the largest lender's.</figcaption>
          </figure>
        </header>

        <section className="bg-navy py-24 text-on-navy" aria-labelledby="numbers">
          <div className="wrap">
            <h2 id="numbers" data-reveal className="text-[clamp(28px,3vw,44px)] text-on-navy">
              The numbers
            </h2>
            <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {NUMBERS.map((n, i) => (
                <div key={n.figure} data-reveal style={{ ["--i" as string]: i }}>
                  <p className="ui num text-[clamp(56px,6vw,96px)] font-bold leading-none tracking-[-0.04em]">{n.figure}</p>
                  <p className="mt-3 text-[17px] text-on-navy">{n.label}</p>
                  <a href={FACTS[n.fact].url} className="ui link mt-2 inline-block text-[13px] text-on-navy-muted">
                    {FACTS[n.fact].source}
                  </a>
                </div>
              ))}
            </div>
            <div className="mt-16 grid gap-6 lg:grid-cols-2">
              {(["changeTime", "regtech", "freeAi", "ucbLimits"] as const).map((k) => (
                <p key={k} data-reveal className="text-[17px] text-on-navy">
                  {FACTS[k].text}{" "}
                  <a href={FACTS[k].url} className="ui link text-[13px] text-on-navy-muted">
                    {FACTS[k].source}
                  </a>
                </p>
              ))}
            </div>
            <p data-reveal className="ui mt-12 max-w-[80ch] text-[13px] text-on-navy-muted">
              A correction to our own deck: the often-quoted USD 18.89 billion RegTech figure for 2025 comes from a January 2022 forecast, so we now quote the 2025 range across analysts. The synthetic circular uses limits of 10% and 12% on purpose, so no one mistakes them for RBI's real 15% and 25%.
            </p>
          </div>
        </section>

        <section className="wrap grid gap-12 py-28 lg:grid-cols-12" aria-labelledby="who">
          <div className="lg:col-span-5">
            <H2 id="who">Who needs it first</H2>
            <p data-reveal className="mt-5 text-[18px]">
              Urban co-operative banks and mid-sized NBFCs carry the same regulatory load as large banks with a fraction of the compliance and IT staff, and they draw most of RBI's penalties. They are the beachhead. Large banks follow as a regulation-to-rule layer over the AML, fraud and limit engines they already run, and IT services firms carry NIYAM into compliance programmes.
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <figure data-reveal className="m-0">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={PICTURES.rbiStreet.src} alt={PICTURES.rbiStreet.alt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
              </div>
              <figcaption className="ui mt-2 text-[13px] text-muted">The Reserve Bank of India, Mumbai. One building, 244 Master Directions, every regulated entity in the country.</figcaption>
            </figure>
          </div>
        </section>

        <section className="wrap py-28" aria-labelledby="measured">
          <H2 id="measured">Measured, not claimed</H2>
          <p data-reveal className="mt-5 max-w-[62ch] text-[18px]">
            We score the rule-based extractor on 30 hand-labelled synthetic clauses written to include the hard cases, and the Validator on ten deliberately broken rules. The numbers below are computed live by this deployment, failures included.
          </p>
          <div className="mt-10">
            <Scorecard />
          </div>
        </section>

        <section className="bg-surface py-28" aria-labelledby="landscape">
          <div className="wrap">
            <H2 id="landscape">Where existing tools stop</H2>
            <p data-reveal className="mt-5 max-w-[60ch] text-[18px]">
              Regulatory-change tools are good at telling a bank what changed and who owns it. None we found takes the last step: a tested, approved, monitored change to a live rule, with a trace back to the clause.
            </p>
            <div data-reveal className="mt-10 overflow-x-auto">
              <table className="ui w-full min-w-[760px] border-collapse bg-bg text-[14px]">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="px-4 py-3 font-normal">Product</th>
                    <th className="px-4 py-3 font-normal">What it does</th>
                    <th className="px-4 py-3 font-normal">Where it stops</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPETITORS.map((c) => (
                    <tr key={c.name} className="align-top odd:bg-surface">
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-4 py-3">{c.what}</td>
                      <td className="px-4 py-3 text-muted">{c.stops}</td>
                    </tr>
                  ))}
                  <tr className="bg-accent text-white">
                    <td className="px-4 py-3 font-semibold">NIYAM</td>
                    <td className="px-4 py-3">Circular to clause, obligation, mapped rule, typed draft, tests, backtest, two signatures, shadow, canary, live.</td>
                    <td className="px-4 py-3">Does not stop until every alert traces back to its sentence, and rolls itself back when the live data drifts.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="ui mt-3 text-[12.5px] text-muted">Based on each vendor's public product descriptions as of October 2026.</p>
          </div>
        </section>

        <section className="wrap py-28" aria-labelledby="papers">
          <H2 id="papers">Research we built on</H2>
          <div className="mt-10 space-y-2">
            {PAPERS.map((p, i) => (
              <article key={p.url} data-reveal style={{ ["--i" as string]: i }} className="grid gap-4 bg-surface p-5 md:grid-cols-12">
                <div className="md:col-span-5">
                  <h3 className="text-[20px] leading-[1.15] tracking-[-0.02em]">
                    <a href={p.url} className="link">
                      {p.title}
                    </a>
                  </h3>
                  <p className="ui mt-2 text-[13px] text-muted">
                    {p.who} · {p.where}
                  </p>
                </div>
                <p className="text-[16px] md:col-span-4">{p.finding}</p>
                <p className="ui text-[14px] text-muted md:col-span-3">
                  <b className="text-ink">In NIYAM:</b> {p.used}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-surface py-28" aria-labelledby="freeai">
          <div className="wrap grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <H2 id="freeai">Built for RBI's FREE-AI sutras</H2>
              <p data-reveal className="mt-5 text-[18px]">
                In August 2025 RBI's FREE-AI committee set seven sutras for AI in finance. Each maps to something NIYAM enforces, not something it promises.
              </p>
              <a href={FACTS.freeAi.url} className="ui link mt-4 inline-block text-[13px] text-muted">
                {FACTS.freeAi.source}
              </a>
            </div>
            <ol className="m-0 p-0 lg:col-span-7 lg:col-start-6">
              {SUTRAS.map(([s, how], i) => (
                <li key={s} data-reveal style={{ ["--i" as string]: i }} className="grid list-none gap-2 py-4 md:grid-cols-[240px_1fr]">
                  <span className="ui text-[18px] font-semibold">{s}</span>
                  <span className="text-[16px]">{how}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="wrap py-28" aria-labelledby="qa">
          <H2 id="qa">Hard questions, straight answers</H2>
          <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
            {QA.map(([q, a], i) => (
              <div key={q} data-reveal style={{ ["--i" as string]: i % 2 }}>
                <h3 className="text-[22px] leading-[1.15] tracking-[-0.02em]">{q}</h3>
                <p className="mt-3 text-[17px]">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-navy py-28 text-on-navy" aria-labelledby="roadmap">
          <div className="wrap">
            <h2 id="roadmap" data-reveal className="text-[clamp(28px,3vw,44px)] text-on-navy">
              From proof of concept to every regulator
            </h2>
            <ol className="m-0 mt-12 grid gap-px p-0 md:grid-cols-5">
              {ROADMAP.map(([when, what, detail], i) => (
                <li key={when} data-reveal style={{ ["--i" as string]: i }} className={`list-none p-5 ${i === 0 ? "bg-accent" : "bg-navy-2"}`}>
                  <p className="ui text-[13px] text-on-navy-muted">{when}</p>
                  <p className="ui mt-1 text-[20px] font-semibold leading-tight">{what}</p>
                  <p className="mt-3 text-[15px] text-on-navy">{detail}</p>
                </li>
              ))}
            </ol>
            <p data-reveal className="mt-14 max-w-[60ch] text-[18px] text-on-navy">
              {TEAM.name}, {TEAM.college}. Built for {TEAM.competition}, {TEAM.track}.
            </p>
            <Link href="/console" className="btn mt-6">
              Run the pipeline
            </Link>
          </div>
        </section>
      </main>
      <Footer credits={["coins", "rbiStreet"]} />
      <Reveal />
    </>
  );
}
