import Link from "next/link";

/** Shared building blocks for the Problem, Existing solution and Our solution pages. */

export function PageHead({ kicker, title, lede }: { kicker: string; title: React.ReactNode; lede: React.ReactNode }) {
  return (
    <header className="wrap pb-14 pt-16 lg:pt-24">
      <p data-reveal className="ui text-[14px] font-semibold uppercase tracking-[0.08em] text-accent">
        {kicker}
      </p>
      <h1 data-reveal style={{ ["--i" as string]: 1 }} className="mt-4 max-w-[18ch] text-[clamp(40px,5.4vw,84px)]">
        {title}
      </h1>
      <p data-reveal style={{ ["--i" as string]: 2 }} className="mt-7 max-w-[60ch] text-[20px] leading-[1.5]">
        {lede}
      </p>
    </header>
  );
}

export function Section({ id, title, intro, tone = "bg", children }: { id: string; title: string; intro?: React.ReactNode; tone?: "bg" | "surface"; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-20 py-20 ${tone === "surface" ? "bg-surface" : ""}`}>
      <div className="wrap">
        <h2 id={`${id}-h`} data-reveal className="text-[clamp(26px,2.8vw,40px)]">
          {title}
        </h2>
        {intro && (
          <p data-reveal className="mt-4 max-w-[64ch] text-[18px] leading-[1.55]">
            {intro}
          </p>
        )}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/** Small titled card. */
export function Card({ title, children, tone = "plain", tag }: { title: string; children: React.ReactNode; tone?: "plain" | "accent" | "ok" | "bad" | "warn" | "navy"; tag?: string }) {
  const bg = { plain: "bg-bg", accent: "bg-accent-soft", ok: "bg-ok-soft", bad: "bg-bad-soft", warn: "bg-warn-soft", navy: "bg-navy text-on-navy" }[tone];
  return (
    <div data-reveal className={`${bg} p-5`}>
      {tag && <p className={`ui text-[12px] font-semibold uppercase tracking-[0.06em] ${tone === "navy" ? "text-on-navy-muted" : "text-muted"}`}>{tag}</p>}
      <h3 className={`ui text-[18px] font-semibold leading-snug ${tone === "navy" ? "text-on-navy" : "text-ink"} ${tag ? "mt-1" : ""}`}>{title}</h3>
      <div className={`mt-2 text-[15.5px] leading-[1.55] ${tone === "navy" ? "text-on-navy" : "text-ink"}`}>{children}</div>
    </div>
  );
}

/** A left-to-right workflow that wraps on small screens. */
export function Flow({ steps, label }: { steps: { title: string; note?: string; tone?: "plain" | "navy" | "accent" | "ok" | "warn" }[]; label: string }) {
  return (
    <ol data-ui role="list" aria-label={label} className="m-0 flex flex-wrap items-stretch gap-y-3 p-0">
      {steps.map((s, i) => {
        const bg = { plain: "bg-bg text-ink", navy: "bg-navy text-on-navy", accent: "bg-accent text-white", ok: "bg-ok-soft text-ink", warn: "bg-warn-soft text-ink" }[s.tone ?? "plain"];
        return (
          <li key={s.title} data-reveal style={{ ["--i" as string]: i % 6 }} className="flex list-none items-stretch">
            <div className={`${bg} flex min-w-[150px] max-w-[220px] flex-col justify-center px-4 py-3`}>
              <span className="text-[15px] font-semibold leading-tight">{s.title}</span>
              {s.note && <span className={`mt-1 text-[12.5px] leading-snug ${s.tone === "navy" || s.tone === "accent" ? "text-white/75" : "text-muted"}`}>{s.note}</span>}
            </div>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="flex items-center px-2 text-[20px] text-muted">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export interface Source {
  label: string;
  url: string;
  note?: string;
}

export function Sources({ items }: { items: Source[] }) {
  return (
    <section aria-labelledby="sources-h" className="bg-surface py-16">
      <div className="wrap">
        <h2 id="sources-h" className="text-[clamp(22px,2.2vw,30px)]">
          Sources and further reading
        </h2>
        <ol className="m-0 mt-6 grid gap-x-10 gap-y-3 p-0 md:grid-cols-2">
          {items.map((s, i) => (
            <li key={s.url} className="ui grid list-none grid-cols-[28px_1fr] text-[14.5px] leading-snug">
              <span className="num text-muted">{i + 1}.</span>
              <span>
                <a href={s.url} className="link text-ink" target="_blank" rel="noreferrer">
                  {s.label}
                </a>
                {s.note && <span className="block text-[13px] text-muted">{s.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Next-page call to action at the bottom of each story page. */
export function Next({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <section className="bg-navy py-16 text-on-navy">
      <div className="wrap flex flex-wrap items-center justify-between gap-6">
        <p className="max-w-[56ch] text-[20px] text-on-navy">{text}</p>
        <Link href={href} className="btn">
          {label}
        </Link>
      </div>
    </section>
  );
}
