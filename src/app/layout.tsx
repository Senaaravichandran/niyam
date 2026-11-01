import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const franklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-franklin",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://niyam-virtusa.vercel.app"),
  title: {
    default: "NIYAM: regulatory circular to live rule",
    template: "%s · NIYAM",
  },
  description:
    "NIYAM turns an RBI circular into a tested, two-person-approved, live bank rule, and traces every alert back to the sentence that caused it. Team Dragorithm, Virtusa Jatayu Season 6.",
  applicationName: "NIYAM",
  authors: [{ name: "Team Dragorithm" }],
  openGraph: {
    title: "NIYAM: every clause becomes a rule",
    description:
      "Agentic AI over A2A and MCP that turns a regulatory circular into a tested, approved, monitored bank rule with a clause-level audit trail.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${franklin.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
