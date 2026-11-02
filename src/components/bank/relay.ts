"use client";

import type { ApprovalView, ReleaseBundle, RunEvent } from "@/niyam/events";

/**
 * Live link from the console to a bank's rule-engine site. The console opens the site in its own
 * window and posts every release event to it; the site replays them through the console's own
 * reducer, so both show the same rollout. A site opened later asks the console to replay.
 */

export type RelayMessage =
  | { niyam: 1; kind: "init"; bank: string; bundle: ReleaseBundle; approvals: ApprovalView[]; path?: string }
  | { niyam: 1; kind: "event"; event: RunEvent }
  | { niyam: 1; kind: "ready"; bank: string };

/** Origins allowed to drive a bank site: the console's production hosts, or this site's own origin. */
export const CONSOLE_ORIGINS = ["https://niyam-virtusa.vercel.app", "https://niyam-ivory.vercel.app"];

export function isRelayMessage(d: unknown): d is RelayMessage {
  const m = d as RelayMessage | null;
  return !!m && typeof m === "object" && m.niyam === 1 && (m.kind === "init" || m.kind === "event" || m.kind === "ready");
}

export class BankRelay {
  private win: Window | null = null;
  private buffer: RelayMessage[] = [];
  private target = "*";
  private bank = "";
  private onMessage = (e: MessageEvent) => {
    if (e.origin !== this.target || !isRelayMessage(e.data) || e.data.kind !== "ready" || e.data.bank !== this.bank) return;
    for (const m of this.buffer) this.win?.postMessage(m, this.target);
  };

  constructor() {
    if (typeof window !== "undefined") window.addEventListener("message", this.onMessage);
  }

  /** Opens (or focuses) the bank's site. Call from a click so the browser allows the window. */
  open(url: string, bank: string) {
    this.target = new URL(url, window.location.href).origin;
    this.bank = bank;
    this.buffer = [];
    this.win = window.open(url, `niyam-bank-${bank}`);
    return !!this.win;
  }

  send(m: RelayMessage) {
    this.buffer.push(m);
    try {
      this.win?.postMessage(m, this.target);
    } catch {
      // The window was closed; the buffer replays if it is opened again.
    }
  }

  close() {
    if (typeof window !== "undefined") window.removeEventListener("message", this.onMessage);
  }
}
