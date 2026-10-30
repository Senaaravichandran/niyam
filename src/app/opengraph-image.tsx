import { ImageResponse } from "next/og";

export const alt = "NIYAM: every clause becomes a rule. Team Dragorithm, Virtusa Jatayu Season 5.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0b1f3a";
const MUTED = "#45546b";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: NAVY,
          padding: "80px 88px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="112" height="112" viewBox="0 0 32 32">
            <rect width="32" height="32" fill={NAVY} />
            <circle cx="10" cy="16" r="4.2" fill="none" stroke="#ffffff" strokeWidth="2.4" />
            <path d="M14.4 16 H25" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="square" />
            <path d="M21.5 11.8 L25.8 16 L21.5 20.2" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="square" />
          </svg>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.03em" }}>NIYAM</div>
        </div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02 }}>
          Every clause becomes a rule.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 34, color: MUTED }}>
          <div style={{ width: 56, height: 8, background: NAVY }} />
          Team Dragorithm · Virtusa Jatayu Season 5
        </div>
      </div>
    ),
    size,
  );
}
