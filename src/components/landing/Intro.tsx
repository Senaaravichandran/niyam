import Image from "next/image";
import { FACTS, PICTURES } from "@/content/site";

const COLUMNS = [
  {
    run: "The volume.",
    body: "In November 2025 RBI folded about 9,000 circulars into 244 Master Directions. Every future change now lands as an amendment: in effect a diff to the rulebook, which no bank system can read as one.",
    fact: FACTS.masterDirections,
  },
  {
    run: "The cost.",
    body: "RBI imposed 353 penalties worth ₹54.78 crore in 2024-25, and 264 of them fell on co-operative banks: the lenders with the leanest compliance teams and the same rulebook as everyone else.",
    fact: FACTS.penalties,
  },
  {
    run: "The delay.",
    body: "Compliance reads the PDF, works out what applies, finds the policies and system rules it touches and raises tickets. Compliance officers say a full regulatory change still takes more than a year.",
    fact: FACTS.changeTime,
  },
  {
    run: "The gap.",
    body: "Regulatory-change tools stop at an obligation register: a list of what must change. The last step, safely changing a live system rule and proving why it fires, is still done by hand.",
    fact: FACTS.regtech,
  },
];

export function Intro() {
  return (
    <section className="wrap pb-24 pt-28 lg:pt-36" aria-labelledby="intro-lead">
      <p id="intro-lead" data-reveal className="max-w-[60ch] text-[clamp(22px,2.2vw,32px)] leading-[1.25] text-ink">
        A regulator changes one number in one paragraph. The bank that must enforce it needs weeks to change the rule in its systems, and every day in between it is either out of compliance or guessing.
      </p>

      <div className="mt-[72px] grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((c, i) => (
          <div key={c.run} data-reveal style={{ ["--i" as string]: i }}>
            <p className="ui text-[15px] leading-[1.5] text-muted">
              <strong className="font-semibold text-ink">{c.run}</strong> {c.body}
            </p>
            <a href={c.fact.url} className="ui link mt-3 inline-block text-[13px] text-soft">
              {c.fact.source}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-24 grid grid-cols-12 gap-3 sm:gap-6">
        <figure data-reveal className="col-span-12 m-0 overflow-hidden sm:col-span-7">
          <div className="relative aspect-[5/4] overflow-hidden">
            <Image src={PICTURES.rbiFront.src} alt={PICTURES.rbiFront.alt} fill sizes="(min-width: 640px) 58vw, 100vw" className="slow-drift object-cover" />
          </div>
          <figcaption className="ui mt-2 text-[13px] text-muted">Where the rules are written: the Reserve Bank of India, Mumbai.</figcaption>
        </figure>
        <div className="col-span-12 grid grid-cols-2 gap-3 sm:col-span-5 sm:gap-6">
          <figure data-reveal style={{ ["--i" as string]: 1 }} className="m-0">
            <div className="relative aspect-[2/3] overflow-hidden">
              <Image src={PICTURES.ledger.src} alt={PICTURES.ledger.alt} fill sizes="(min-width: 640px) 20vw, 50vw" className="object-cover object-top" />
            </div>
            <figcaption className="ui mt-2 text-[13px] text-muted">How rule changes still feel: by hand, line by line.</figcaption>
          </figure>
          <figure data-reveal style={{ ["--i" as string]: 2 }} className="m-0">
            <div className="relative aspect-[2/3] overflow-hidden">
              <Image src={PICTURES.rbiTower.src} alt={PICTURES.rbiTower.alt} fill sizes="(min-width: 640px) 20vw, 50vw" className="object-cover" />
            </div>
            <figcaption className="ui mt-2 text-[13px] text-muted">244 Master Directions, each now amended in place.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
