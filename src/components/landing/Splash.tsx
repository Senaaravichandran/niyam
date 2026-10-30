"use client";

import { useEffect, useState } from "react";
import { Mark } from "../Logo";

/**
 * Opening card for the competition: Virtusa Jatayu Season 5, the track, the team, then NIYAM.
 * Shown once per browser session, skippable with a click or any key. It is in the server HTML,
 * so it covers the page from the first paint; a tiny inline script hides it on repeat visits
 * before anything is drawn.
 */
const KEY = "niyam-intro-seen";
const BRAND_BG = "#1f1a50";

export function Splash() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* storage blocked: show it */
    }
    if (seen) {
      setPhase("gone");
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leaveAt = reduce ? 1800 : 3600;
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
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("${KEY}")==="1")document.documentElement.classList.add("intro-seen")}catch(e){}`,
        }}
      />
      <div
        role="dialog"
        aria-label="Virtusa Jatayu Season 5, FDS NA Use Case 2. NIYAM by Team Dragorithm."
        onClick={() => {
          setPhase("leaving");
          setTimeout(() => setPhase("gone"), 500);
        }}
        className={`splash fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center px-6 text-center transition-opacity duration-700 ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
        style={{ background: BRAND_BG }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/virtusa-jatayu.png" alt="Virtusa Jatayu" width={271} height={91} className="splash-in h-auto w-[200px] sm:w-[260px]" style={{ ["--d" as string]: "0ms" }} />
        <p className="splash-in ui mt-7 text-[clamp(30px,4vw,52px)] font-light leading-none tracking-[-0.02em] text-white" style={{ ["--d" as string]: "250ms" }}>
          Season 5
        </p>
        <p className="splash-in ui mt-5 max-w-[34ch] text-[16px] leading-snug text-[#c9c3f2]" style={{ ["--d" as string]: "550ms" }}>
          FDS NA, Use Case 2 · Regulatory Circular to Live Rule Engine
        </p>
        <div className="splash-in mt-14 flex items-center gap-3" style={{ ["--d" as string]: "1100ms" }}>
          <Mark size={40} className="ring-1 ring-white/30" />
          <span className="ui text-[34px] font-bold tracking-[-0.03em] text-white">NIYAM</span>
        </div>
        <p className="splash-in ui mt-3 text-[15px] text-[#c9c3f2]" style={{ ["--d" as string]: "1350ms" }}>
          by Team Dragorithm · Sri Manakula Vinayagar Engineering College
        </p>
        <p className="splash-in ui absolute bottom-6 text-[13px] text-[#8f88c9]" style={{ ["--d" as string]: "1800ms" }}>
          Click or press any key to continue
        </p>
      </div>
    </>
  );
}
