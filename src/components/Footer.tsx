import Link from "next/link";
import { PICTURES, REPO_URL, TEAM } from "@/content/site";

export function Footer({ credits = [] as (keyof typeof PICTURES)[] }) {
  return (
    <footer className="wrap pb-8 pt-[22svh]">
      <div className="ui grid gap-2 text-[15px] md:grid-cols-[1fr_auto_1fr] md:items-baseline md:gap-6">
        <p className="text-muted">NIYAM, by {TEAM.name}</p>
        <ul className="m-0 flex flex-wrap gap-x-6 gap-y-1 p-0">
          {[
            { href: "/console", label: "Console" },
            { href: "/architecture", label: "Architecture" },
            { href: "/research", label: "Research" },
            { href: REPO_URL, label: "Source" },
          ].map((l) => (
            <li key={l.href} className="list-none">
              <Link href={l.href} className="text-ink no-underline hover:text-accent">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-muted md:text-right">{TEAM.competition}, 2026</p>
      </div>
      <p className="ui mt-6 max-w-[78ch] text-[13px] leading-relaxed text-soft">
        Every circular, rule, approver, loan and alert shown here is synthetic and labelled so. RBI statistics are public and cited at their source.
        {credits.length > 0 && (
          <>
            {" "}Pictures:{" "}
            {credits.map((k, i) => (
              <span key={k}>
                <a href={PICTURES[k].url} className="link">
                  {PICTURES[k].credit}
                </a>
                {i < credits.length - 1 ? "; " : "."}
              </span>
            ))}
          </>
        )}
      </p>
    </footer>
  );
}
