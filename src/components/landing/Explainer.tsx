import Link from "next/link";
import { TEAM } from "@/content/site";

/** The team's own two-minute explainer, made for the Jatayu submission. */
export function Explainer() {
  return (
    <section className="bg-surface py-24 lg:py-32" aria-labelledby="explainer-title">
      <div className="wrap grid gap-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-4">
          <h2 id="explainer-title" data-reveal className="text-[clamp(32px,3.6vw,56px)]">
            Two minutes, start to finish
          </h2>
          <p data-reveal style={{ ["--i" as string]: 1 }} className="mt-6 text-[18px]">
            Our explainer for {TEAM.competition}: the problem, the seven agents, the Validator catching “exceeding”, two signatures, shadow and canary, the rollback, and the Golden Thread.
          </p>
          <p data-reveal style={{ ["--i" as string]: 2 }} className="ui mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
            <Link href="/jatayu" className="link">
              The Jatayu submission
            </Link>
            <Link href="/console" className="link">
              Run it yourself
            </Link>
          </p>
        </div>
        <figure data-reveal style={{ ["--i" as string]: 1 }} className="m-0 lg:col-span-8">
          <video
            className="block aspect-video w-full bg-navy"
            controls
            preload="metadata"
            playsInline
            poster="/media/niyam-explainer-poster.jpg"
          >
            <source src="/media/niyam-explainer.mp4" type="video/mp4" />
            <a href="/media/niyam-explainer.mp4">Download the explainer video</a>
          </video>
          <figcaption className="ui mt-2 text-[13px] text-muted">
            {TEAM.name} · {TEAM.track} · demo data is synthetic and labelled so in the film.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
