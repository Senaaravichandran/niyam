import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { TryTool } from "@/components/try/TryTool";

export const metadata: Metadata = {
  title: "Try your own circular",
  description:
    "Paste a regulatory circular and watch NIYAM's Reader and Extractor scope its clauses, extract obligations with verified source spans, draft typed rules and run their boundary tests. Analysis only; nothing is deployed.",
};

export default function TryPage() {
  return (
    <>
      <Nav />
      <main>
        <header className="wrap grid gap-8 pb-12 pt-20 lg:grid-cols-12 lg:pt-24">
          <div className="lg:col-span-8">
            <h1 data-reveal className="text-[clamp(40px,5.4vw,88px)]">
              Try your own circular
            </h1>
            <p data-reveal style={{ ["--i" as string]: 1 }} className="mt-8 max-w-[56ch] text-[20px] leading-[1.5]">
              Paste a circular, pick your entity type and press Analyse. NIYAM scopes each clause, extracts obligations with the exact sentence they came from, reads each comparator into an operator, and drafts a rule with its boundary tests.
            </p>
          </div>
          <p data-reveal style={{ ["--i" as string]: 2 }} className="ui self-end text-[15px] leading-relaxed text-muted lg:col-span-4">
            This is analysis only. Nothing you paste is stored, nothing is approved, and no rule reaches the engine. The full path from draft to live rule runs in the console with two human signatures.
          </p>
        </header>
        <TryTool />
      </main>
      <Footer />
      <Reveal />
    </>
  );
}
