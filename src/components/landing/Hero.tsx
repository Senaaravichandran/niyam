"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HERO_FRAMES } from "./Fragments";

/**
 * Hero: the sentence is split by a frame. The two halves hold still while a reel of interface
 * fragments passes through the frame as the page scrolls (pinned story).
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
        setProgress(p);
        setStep(Math.min(HERO_FRAMES.length - 1, Math.floor(p * HERO_FRAMES.length * 0.999)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Desktop and tablet: pinned stage */}
      <section ref={section} className="relative hidden lg:block" style={{ height: `${100 + HERO_FRAMES.length * 55}svh` }} aria-label="Introduction">
        <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden">
          <div className="relative flex-1">
            <h1 className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2" style={{ fontSize: "clamp(36px, 3.8vw, 68px)" }}>
              <span className="wrap flex items-center justify-between">
                <span>Every clause</span>
                <span className="text-right">becomes a rule.</span>
              </span>
            </h1>

            {/* The reel: one frame centred, 60px of each neighbour showing at the window's edges */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
              style={{ width: "var(--fw)", height: "calc(var(--fw) * 0.66 + 168px)", ["--fw" as string]: "clamp(320px, 30vw, 520px)" }}
            >
              <div
                className="transition-transform duration-700"
                style={{
                  transitionTimingFunction: "var(--ease-out)",
                  transform: `translateY(calc(84px - ${step} * (var(--fw) * 0.66 + 24px)))`,
                }}
              >
                {HERO_FRAMES.map((f, i) => (
                  <figure
                    key={f.key}
                    className="m-0 mb-6 overflow-hidden bg-surface p-2 transition-opacity duration-500"
                    style={{ height: "calc(var(--fw) * 0.66)", opacity: i === step ? 1 : 0.4 }}
                    aria-hidden={i !== step}
                  >
                    <div className="h-full overflow-hidden">{f.node}</div>
                  </figure>
                ))}
              </div>
            </div>
          </div>

          <div className="wrap grid grid-cols-12 items-end gap-6 pb-8">
            <p className="ui col-span-5 text-[18px] leading-[1.45] text-ink">
              NIYAM is a team of AI agents that turns an RBI circular into a tested, two-person-approved, live bank rule, and traces every alert back to the sentence that caused it.
            </p>
            <div className="col-span-4 col-start-6 text-center">
              <p className="ui text-[15px] text-muted" aria-live="polite">
                {HERO_FRAMES[step].label}
              </p>
              <div className="mx-auto mt-3 h-1 w-40 bg-surface-2">
                <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${Math.max(6, progress * 100)}%` }} />
              </div>
            </div>
            <div className="col-span-3 flex justify-end">
              <Link href="/console" className="btn">
                Watch it run
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Phone: the halves stack around the frames */}
      <section className="lg:hidden" aria-label="Introduction">
        <div className="wrap pt-6">
          <h1 style={{ fontSize: "11vw" }}>Every clause</h1>
        </div>
        <div className="scrollbar-none mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
          {HERO_FRAMES.map((f) => (
            <figure key={f.key} className="m-0 w-[88vw] shrink-0 snap-center bg-surface p-1.5">
              <div className="min-h-[250px] overflow-hidden">{f.node}</div>
              <figcaption className="ui px-1 pb-1 pt-2 text-[13px] text-muted">{f.label}</figcaption>
            </figure>
          ))}
        </div>
        <div className="wrap mt-5">
          <h1 className="text-right" style={{ fontSize: "11vw" }}>
            becomes a rule.
          </h1>
          <p className="ui mt-6 text-[16px] leading-[1.5]">
            NIYAM is a team of AI agents that turns an RBI circular into a tested, two-person-approved, live bank rule, and traces every alert back to the sentence that caused it.
          </p>
          <Link href="/console" className="btn mt-5">
            Watch it run
          </Link>
        </div>
      </section>
    </>
  );
}
