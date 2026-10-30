import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { COVERAGE, TEMPLATE, USE_CASE, VIRTUSA_FIT, ROLES, BUILD_STATUS } from "@/content/jatayu";
import { REPO_URL, TEAM } from "@/content/site";

export const metadata: Metadata = {
  title: "Jatayu submission",
  description:
    "NIYAM by Team Dragorithm for Virtusa Jatayu Season 5, FDS NA Use Case 2: the explainer video, the official use case, and every workflow step, data source, stack item and guardrail mapped to running code.",
};

const VIDEO = "/media/niyam-explainer.mp4";
const POSTER = "/media/niyam-explainer-poster.jpg";

function H2({ id, children, onNavy = false }: { id: string; children: React.ReactNode; onNavy?: boolean }) {
  return (
    <h2 id={id} data-reveal className={`scroll-mt-20 text-[clamp(28px,3vw,44px)] ${onNavy ? "text-on-navy" : ""}`}>
      {children}
    </h2>
  );
}

const DETAILS: [string, string][] = [
  ["Track", TEAM.track],
  ["Team", TEAM.name],
  ["Members", TEAM.members.join(", ")],
  ["Mentor", TEAM.mentor],
  ["College", `${TEAM.college}, Madagadipet, Puducherry`],
];

function isExternal(href: string) {
  return href.startsWith("http");
}

export default function JatayuPage() {
  return (
    <>
      <Nav />
      <main>
        <header className="wrap grid gap-10 pb-20 pt-20 lg:grid-cols-12 lg:pt-28">
          <div className="lg:col-span-7">
            <h1 data-reveal className="text-[clamp(40px,5vw,80px)]">
              NIYAM for Virtusa Jatayu Season 5
            </h1>
            <p data-reveal style={{ ["--i" as string]: 1 }} className="mt-8 max-w-[52ch] text-[20px] leading-[1.5]">
              NIYAM turns a regulatory circular into a tested, two-person-approved, monitored bank rule, and traces every alert back to the sentence that caused it. This page answers the use case point by point, with a link to see each one running.
            </p>
          </div>
          <dl data-reveal style={{ ["--i" as string]: 2 }} className="m-0 grid content-start gap-5 lg:col-span-5">
            {DETAILS.map(([k, v]) => (
              <div key={k} className="grid gap-1 sm:grid-cols-[120px_1fr]">
                <dt className="ui text-[16px] font-semibold">{k}</dt>
                <dd className="m-0 text-[17px]">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="bg-surface py-24" aria-labelledby="video">
          <div className="wrap grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <H2 id="video">The two-minute explainer</H2>
              <p data-reveal className="mt-5 text-[18px]">
                Made by the team for this entry. It follows one amending circular from clause to obligation, through the agents, a drafted rule and the Validator's objection, to two approvals, shadow and canary release, and an automatic rollback when the Sentinel sees drift.
              </p>
              <p data-reveal className="mt-4 text-[16px]">
                Captions are burned into the video. It illustrates the flow with a know-your-customer cash-deposit clause; the console runs a synthetic exposure-limit circular. Where the two differ, the console and the code are the reference.
              </p>
            </div>
            <figure data-reveal className="m-0 lg:col-span-8">
              <video controls preload="metadata" playsInline poster={POSTER} className="block aspect-video w-full bg-bg">
                <source src={VIDEO} type="video/mp4" />
                <a href={VIDEO} className="link">
                  Download the NIYAM explainer video (MP4)
                </a>
              </video>
              <figcaption className="mt-3 text-[16px]">
                1 minute 57 seconds.{" "}
                <a href={VIDEO} className="link">
                  Open the video file
                </a>{" "}
                if it does not play here. The music credit is in the last frame.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="wrap py-28" aria-labelledby="usecase">
          <H2 id="usecase">The use case, as issued</H2>
          <p data-reveal className="mt-5 max-w-[62ch] text-[18px]">
            The official text of FDS NA Use Case 2, word for word.
          </p>
          <div data-reveal className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[16px]">
              <tbody>
                {USE_CASE.map(([k, v]) => (
                  <tr key={k} className="align-top odd:bg-surface">
                    <th scope="row" className="ui w-[200px] px-4 py-4 text-left text-[16px] font-semibold">
                      {k}
                    </th>
                    <td className="px-4 py-4">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-surface py-28" aria-labelledby="coverage">
          <div className="wrap">
            <H2 id="coverage">Every item, mapped to running code</H2>
            <p data-reveal className="mt-5 max-w-[62ch] text-[18px]">
              Each workflow step, data source, stack item and guardrail in the use case, split as listed. Every row links to where it runs in the console or architecture page, and to the file that does it.
            </p>
            {COVERAGE.map((g) => (
              <div key={g.id} className="mt-16">
                <h3 id={g.id} data-reveal className="scroll-mt-20 text-[clamp(22px,2vw,30px)]">
                  {g.title}
                </h3>
                <div data-reveal className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse bg-bg text-[16px]">
                    <thead>
                      <tr className="ui text-left">
                        <th scope="col" className="w-[220px] px-4 py-3 font-semibold">
                          Item
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          How NIYAM does it
                        </th>
                        <th scope="col" className="w-[260px] px-4 py-3 font-semibold">
                          See it
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.item} className="align-top odd:bg-surface">
                          <th scope="row" className="ui px-4 py-3 text-left text-[16px] font-semibold">
                            {r.item}
                          </th>
                          <td className="px-4 py-3">{r.how}</td>
                          <td className="ui px-4 py-3 text-[16px]">
                            <Link href={r.see.href} className="link block">
                              {r.see.label}
                            </Link>
                            <a href={`${REPO_URL}/blob/main/${r.file}`} className="link mt-1 block break-all">
                              {r.file.replace("src/niyam/", "")}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap py-28" aria-labelledby="reconcile">
          <H2 id="reconcile">Proposal and build, side by side</H2>
          <p data-reveal className="mt-5 max-w-[64ch] text-[18px]">
            Our Stage 1 submission described ten agent roles. The working build covers all ten with seven agents: intake and applicability became one Reader, the Backtester and Impact Analyst became a skill of the Validator, and the Sentinel became a monitoring tool. Here is the exact mapping, and what is running versus planned.
          </p>
          <div data-reveal className="mt-10 overflow-x-auto">
            <table className="ui w-full min-w-[760px] border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-3 py-2 font-normal">Proposed role (Stage 1)</th>
                  <th className="px-3 py-2 font-normal">Implemented as</th>
                  <th className="px-3 py-2 font-normal">Why</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r.proposed} className="align-top odd:bg-surface">
                    <td className="px-3 py-2 font-semibold">{r.proposed}</td>
                    <td className="px-3 py-2">{r.built}</td>
                    <td className="px-3 py-2 text-muted">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div data-reveal className="mt-12 grid gap-2 md:grid-cols-2">
            {BUILD_STATUS.map((b) => (
              <div key={b.part} className={`p-4 ${b.status === "running" ? "bg-ok-soft" : "bg-warn-soft"}`}>
                <p className="ui text-[15px] font-semibold text-ink">
                  {b.part} <span className={b.status === "running" ? "text-ok" : "text-warn"}>· {b.status === "running" ? "running now" : "production plan"}</span>
                </p>
                <p className="mt-1 text-[16px] text-ink">{b.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap py-28" aria-labelledby="template">
          <H2 id="template">The submission, in the template's terms</H2>
          <div className="mt-12 grid gap-x-12 gap-y-14 lg:grid-cols-2">
            {TEMPLATE.map((t, i) => (
              <article key={t.id} id={t.id} data-reveal style={{ ["--i" as string]: i % 2 }} className="scroll-mt-20">
                <h3 className="text-[clamp(22px,2vw,30px)]">{t.title}</h3>
                {t.paras.map((p) => (
                  <p key={p.slice(0, 32)} className="mt-4 text-[17px]">
                    {p}
                  </p>
                ))}
              </article>
            ))}
          </div>
          <p data-reveal className="mt-12 text-[16px]">
            Every figure above has its source on the{" "}
            <Link href="/research" className="link">
              research page
            </Link>
            .
          </p>
        </section>

        <section className="bg-navy py-28 text-on-navy" aria-labelledby="virtusa">
          <div className="wrap">
            <H2 id="virtusa" onNavy>
              Why it fits Virtusa
            </H2>
            <p data-reveal className="mt-5 max-w-[62ch] text-[18px] text-on-navy">
              For an IT services firm with BFSI clients, NIYAM is an accelerator: a regulation-to-rule layer that can be carried from one client to the next.
            </p>
            <div className="mt-12 grid gap-px md:grid-cols-2">
              {VIRTUSA_FIT.map(([title, body], i) => (
                <div key={title} data-reveal style={{ ["--i" as string]: i % 2 }} className="bg-navy-2 p-6">
                  <h3 className="text-[22px] leading-[1.15] text-on-navy">{title}</h3>
                  <p className="mt-3 text-[17px] text-on-navy">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="wrap py-28" aria-labelledby="links">
          <H2 id="links">See it for yourself</H2>
          <p data-reveal className="mt-5 max-w-[62ch] text-[18px]">
            The console runs the whole pipeline live on synthetic data, from circular to approval, rollout and rollback.
          </p>
          <div data-reveal className="mt-8 flex flex-wrap gap-3">
            {[
              { href: "/console", label: "Run the console", quiet: false },
              { href: "/architecture", label: "Architecture", quiet: true },
              { href: "/research", label: "Research", quiet: true },
              { href: REPO_URL, label: "GitHub repository", quiet: true },
            ].map((l) =>
              isExternal(l.href) ? (
                <a key={l.href} href={l.href} className="btn btn-quiet">
                  {l.label}
                </a>
              ) : (
                <Link key={l.href} href={l.href} className={`btn ${l.quiet ? "btn-quiet" : ""}`}>
                  {l.label}
                </Link>
              ),
            )}
          </div>
          <p data-reveal className="mt-14 max-w-[62ch] text-[17px]">
            {TEAM.name}: {TEAM.members.join(", ")}. Mentor {TEAM.mentor}. {TEAM.college}, {TEAM.place}.
          </p>
        </section>
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
