"use client";

import { useEffect, useState } from "react";
import { Mark } from "../Logo";

/**
 * Opening card for the competition: the Virtusa Jatayu lockup (green star and wordmark, as on the
 * official template), Season 5, the track and the team, then NIYAM. Shown on every load, then it
 * fades away; a click or any key skips it.
 */
export function Splash() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leaveAt = reduce ? 1800 : 3400;
    const t1 = setTimeout(() => setPhase("leaving"), leaveAt);
    const t2 = setTimeout(() => setPhase("gone"), leaveAt + 700);
    const skip = () => {
      clearTimeout(t1);
      clearTimeout(t2);
      setPhase("leaving");
      setTimeout(() => setPhase("gone"), 500);
    };
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = phase === "gone" ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      role="dialog"
      aria-label="Virtusa Jatayu Season 5, FDS NA Use Case 2. NIYAM by Team Dragorithm."
      onClick={() => {
        setPhase("leaving");
        setTimeout(() => setPhase("gone"), 500);
      }}
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-bg px-6 text-center transition-opacity duration-700 ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
    >
      <div className="splash-in flex items-center gap-5" style={{ ["--d" as string]: "0ms" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/jatayu-star.png" alt="" width={149} height={149} className="h-[64px] w-[64px] sm:h-[76px] sm:w-[76px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/virtusa.png" alt="Virtusa" width={352} height={149} className="h-auto w-[150px] sm:w-[180px]" />
      </div>
      <p className="splash-in ui mt-8 text-[clamp(30px,4vw,52px)] font-light leading-none tracking-[-0.02em] text-ink" style={{ ["--d" as string]: "250ms" }}>
        Jatayu Season 5
      </p>
      <p className="splash-in ui mt-5 max-w-[36ch] text-[16px] leading-snug text-muted" style={{ ["--d" as string]: "550ms" }}>
        FDS NA, Use Case 2 · Regulatory Circular to Live Rule Engine
      </p>
      <div className="splash-in mt-14 flex items-center gap-3" style={{ ["--d" as string]: "1100ms" }}>
        <Mark size={40} />
        <span className="ui text-[34px] font-bold tracking-[-0.03em] text-ink">NIYAM</span>
      </div>
      <p className="splash-in ui mt-3 text-[15px] text-muted" style={{ ["--d" as string]: "1350ms" }}>
        by Team Dragorithm · Sri Manakula Vinayagar Engineering College
      </p>
      <p className="splash-in ui absolute bottom-6 text-[13px] text-soft" style={{ ["--d" as string]: "1800ms" }}>
        Click or press any key to continue
      </p>
    </div>
  );
}
