import type { Metadata } from "next";
import { Console } from "@/components/console/Console";

export const metadata: Metadata = {
  title: "Pipeline console",
  description: "Run NIYAM end to end for one of four synthetic banks: its own circular PDF, agents, objections, tests, backtest, two-person approval, and a live rollout on the bank's own site.",
};

/** The console has its own bar (back, bank, mode, Run), so the site navigation is not shown here. */
export default function ConsolePage() {
  return <Console />;
}
