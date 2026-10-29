"use client";

import { useEffect } from "react";

/**
 * Staggered entrances. Content is fully visible without script; this only adds the travel,
 * once, as each block enters the viewport.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    // Elements already on screen stay visible; only those below the fold get the entrance.
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92) el.classList.add("is-in");
      io.observe(el);
    }
    root.classList.add("reveal-ready");
    return () => io.disconnect();
  }, []);
  return null;
}
