import Link from "next/link";
import { Wordmark } from "./Logo";

const LINKS = [
  { href: "/problem", label: "Problem" },
  { href: "/existing", label: "Existing solution" },
  { href: "/solution", label: "Our solution & uniqueness" },
  { href: "/architecture", label: "Architecture" },
  { href: "/research", label: "Research" },
  { href: "/jatayu", label: "Jatayu" },
];

/** `console`: the console has its own Run button and pinned narrator, so the bar drops its CTA and scrolls away. */
export function Nav({ tone = "light", console = false }: { tone?: "light" | "surface"; console?: boolean }) {
  return (
    <header className={`${console ? "relative" : "sticky top-0"} z-30 ${tone === "surface" ? "bg-surface" : "bg-bg"}`}>
      <nav className="wrap flex h-16 items-center justify-between gap-6" aria-label="Main">
        <Link href="/" className="no-underline" aria-label="NIYAM home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2 sm:gap-5">
          <ul className="m-0 hidden items-center gap-5 p-0 xl:flex">
            {LINKS.map((l) => (
              <li key={l.href} className="list-none">
                <Link href={l.href} className="ui whitespace-nowrap text-[15px] text-ink no-underline transition-colors hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* Below xl: the same links in a menu that needs no JavaScript. */}
          <details className="group xl:hidden">
            <summary className="ui flex cursor-pointer list-none items-center gap-1.5 px-2 py-1 text-[15px] text-ink hover:text-accent [&::-webkit-details-marker]:hidden">
              Menu
              <span aria-hidden="true" className="text-[11px] transition-transform group-open:rotate-180">
                ▼
              </span>
            </summary>
            <ul className="absolute left-4 right-4 top-full m-0 bg-bg p-2 shadow-[0_12px_32px_rgba(11,31,58,0.14)] sm:left-auto sm:right-8 sm:w-[280px]">
              {LINKS.map((l) => (
                <li key={l.href} className="list-none">
                  <Link href={l.href} className="ui block px-3 py-2.5 text-[15px] text-ink no-underline hover:bg-surface hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          {!console && (
            <Link href="/console" className="btn whitespace-nowrap">
              Run the pipeline
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
