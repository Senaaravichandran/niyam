import type { Metadata } from "next";
import { Console } from "@/components/console/Console";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Pipeline console",
  description: "Run NIYAM end to end on a synthetic RBI circular: agents, objections, tests, backtest, two-person approval, rollout, rollback and the Golden Thread.",
};

export default function ConsolePage() {
  return (
    <>
      <Nav tone="surface" console />
      <Console />
    </>
  );
}
