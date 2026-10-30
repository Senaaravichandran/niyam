import Link from "next/link";
import { PICTURES, REPO_URL, TEAM } from "@/content/site";
import { Mark } from "./Logo";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/console", label: "Pipeline console" },
      { href: "/try", label: "Try a circular" },
      { href: "/architecture", label: "Architecture" },
    ],
  },
  {
    title: "Research",
    links: [
      { href: "/research", label: "Research and sources" },
      { href: "/jatayu", label: "Jatayu submission" },
      { href: REPO_URL, label: "Source on GitHub" },
    ],
  },
];

export function Footer({ credits = [] as (keyof typeof PICTURES)[] }) {
  return (
    <footer className="bg-navy text-on-navy">
      <div className="wrap pb-10 pt-20 lg:pt-24">
        {/* Sign-off */}
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-4">
              <Mark size={52} className="ring-1 ring-white/25" />
              <span className="ui text-[clamp(44px,6vw,88px)] font-bold leading-none tracking-[-0.04em] text-white">NIYAM</span>
            </div>
            <p className="ui mt-5 text-[clamp(20px,2vw,28px)] leading-tight text-on-navy">Every clause becomes a rule.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <Link href="/console" className="btn">
              Run the pipeline
            </Link>
            <Link href="/try" className="btn bg-navy-2 hover:bg-[#1b3a66]">
              Try a circular
            </Link>
          </div>
        </div>

        {/* Columns */}
        <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title} className="lg:col-span-2">
              <p className="ui text-[14px] font-semibold text-white">{c.title}</p>
              <ul className="m-0 mt-4 space-y-2.5 p-0">
                {c.links.map((l) => (
                  <li key={l.href} className="list-none">
                    <Link href={l.href} className="ui text-[15px] text-on-navy-muted no-underline transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="lg:col-span-4">
            <p className="ui text-[14px] font-semibold text-white">{TEAM.name}</p>
            <p className="ui mt-4 text-[15px] leading-relaxed text-on-navy-muted">
              {TEAM.members.join(", ")}
              <br />
              Mentor: {TEAM.mentor}
              <br />
              {TEAM.college}, {TEAM.place}
            </p>
          </div>
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/jatayu-star.png" alt="" width={149} height={149} className="h-10 w-10" />
              <p className="ui text-[14px] font-semibold text-white">Virtusa Jatayu Season 5</p>
            </div>
            <p className="ui mt-4 text-[15px] leading-relaxed text-on-navy-muted">
              FDS NA, Use Case 2
              <br />
              Regulatory Circular to Live Rule Engine
            </p>
          </div>
        </div>

        {/* Fine print */}
        <div className="mt-16 bg-navy-2 px-5 py-4">
          <p className="ui text-[13px] leading-relaxed text-on-navy-muted">
            Every circular, rule, approver, loan and alert shown here is synthetic and labelled so. RBI statistics are public and cited at their source.
            {credits.length > 0 && (
              <>
                {" "}Pictures:{" "}
                {credits.map((k, i) => (
                  <span key={k}>
                    <a href={PICTURES[k].url} className="text-on-navy-muted underline decoration-1 underline-offset-2 hover:text-white">
                      {PICTURES[k].credit}
                    </a>
                    {i < credits.length - 1 ? "; " : "."}
                  </span>
                ))}
              </>
            )}
          </p>
        </div>
        <p className="ui mt-6 text-[13px] text-on-navy-muted">© 2026 {TEAM.name} · Built for {TEAM.competition}</p>
      </div>
    </footer>
  );
}
