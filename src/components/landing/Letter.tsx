import Image from "next/image";
import { PICTURES, TEAM } from "@/content/site";
import { Mark } from "../Logo";

export function Letter() {
  return (
    <section className="pb-28 pt-32 lg:pb-32 lg:pt-40" aria-labelledby="letter-title">
      <div className="wrap grid gap-12 lg:grid-cols-12">
        <figure data-reveal className="m-0 lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image src={PICTURES.pondy.src} alt={PICTURES.pondy.alt} fill sizes="(min-width: 1024px) 38vw, 100vw" className="slow-drift object-cover" />
          </div>
          <figcaption className="ui mt-2 text-[13px] text-muted">Puducherry, where NIYAM was built. Every street has a bank branch living with the same rulebook.</figcaption>
        </figure>

        <article className="mx-auto w-full max-w-[540px] lg:col-span-6 lg:col-start-7">
          <h2 id="letter-title" className="sr-only">
            A note from Team Dragorithm
          </h2>
          <div data-reveal className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full">
            <Mark size={44} />
          </div>
          <div className="mt-7 space-y-5 text-[17px] leading-[1.6] text-ink">
            <p data-reveal style={{ ["--i" as string]: 1 }}>
              We are five engineering students from Puducherry. We picked the regulatory-circular problem because it looked like the place where AI could do the most good, and the most harm.
            </p>
            <p data-reveal style={{ ["--i" as string]: 2 }}>
              A model that reads a circular well is not hard to build. What we could not find was one you could trust to change a live rule: one that shows its working, that a second agent is built to disagree with, and that{" "}
              <span className="bg-accent-soft px-1">cannot reach production without two people signing the exact file</span>.
            </p>
            <p data-reveal style={{ ["--i" as string]: 3 }}>
              So NIYAM keeps language work and decisions apart. Claude reads and drafts. Deterministic code compiles, tests, backtests, deploys and rolls back. People approve. Every alert carries the sentence it came from.
            </p>
            <p data-reveal style={{ ["--i" as string]: 4 }}>
              Everything you can run here is synthetic: the circular, the bank, its loans and its approvers. The RBI figures are real and cited. Run the console, try to break it, and tell us where it bends.
            </p>
          </div>
          <div data-reveal style={{ ["--i" as string]: 5 }} className="mt-9">
            <p className="text-[22px] italic">Senaaravichandran A, for {TEAM.name}</p>
            <p className="ui mt-1 text-[14px] text-muted">
              With {TEAM.members.slice(1).join(", ")}. Mentored by {TEAM.mentor}. {TEAM.college}, {TEAM.place}.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
