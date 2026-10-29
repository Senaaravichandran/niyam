import Link from "next/link";
import { Wordmark } from "./Logo";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/architecture", label: "Architecture" },
  { href: "/research", label: "Research" },
];

export function Nav({ tone = "light" }: { tone?: "light" | "surface" }) {
  return (
    <header className={`sticky top-0 z-30 ${tone === "surface" ? "bg-surface" : "bg-bg"}`}>
      <nav className="wrap flex h-16 items-center justify-between gap-6" aria-label="Main">
        <Link href="/" className="no-underline" aria-label="NIYAM home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1 sm:gap-6">
          <ul className="hidden items-center gap-6 md:flex">
            {LINKS.map((l) => (
              <li key={l.href} className="list-none">
                <Link href={l.href} className="ui text-[15px] text-ink no-underline transition-colors hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/research" className="ui px-2 text-[15px] text-ink no-underline hover:text-accent md:hidden">
            Research
          </Link>
          <Link href="/console" className="btn">
            Run the pipeline
          </Link>
        </div>
      </nav>
    </header>
  );
}
