"use client";

import { useMemo } from "react";
import { AGENTS } from "@/niyam/a2a/cards";
import { ALLOWLIST, TOOL_SERVER } from "@/niyam/mcp/allowlist";
import type { RunState } from "./state";

/* Geometry lives in a 1000 x 600 viewBox; the wide stage keeps that aspect so % positions match the SVG. */
const W = 1000;
const H = 600;
const POS: Record<string, [number, number]> = {
  conductor: [500, 215],
  reader: [130, 95],
  extractor: [375, 60],
  mapper: [625, 60],
  author: [870, 95],
  validator: [870, 330],
  release: [130, 330],
  human: [340, 400],
};
const SERVERS = ["regulatory-kg", "semantic-model", "dsl-compiler", "backtest", "git-draft", "approvals", "deploy-monitor"];
SERVERS.forEach((sv, i) => (POS[`mcp:${sv}`] = [80 + i * 140, 540]));

const WORKERS = AGENTS.filter((a) => a.id !== "conductor");
const LABEL: Record<string, string> = Object.fromEntries([...AGENTS.map((a) => [a.id, a.name]), ["human", "Humans"]]);
const label = (id: string) => LABEL[id] ?? id;

/* Faint allowlist edges: agent -> each MCP server it may reach. */
const MCP_EDGES: [string, string][] = Object.entries(ALLOWLIST).flatMap(([agent, tools]) =>
  [...new Set(tools.map((t) => TOOL_SERVER[t]).filter(Boolean))].map((sv) => [agent, `mcp:${sv}`] as [string, string]),
);

const CSS = `
@keyframes mesh-travel { from { transform: translate(var(--x1), var(--y1)); } to { transform: translate(var(--x2), var(--y2)); } }
@keyframes mesh-flash { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
.mesh-dot { animation: mesh-travel 1100ms cubic-bezier(0.45, 0, 0.25, 1) infinite; }
.mesh-flash { animation: mesh-flash 1600ms ease-out forwards; }
@media (prefers-reduced-motion: reduce) {
  .mesh-dot { animation: none; display: none; }
  .mesh-flash { animation: none; }
}`;

const IDLE_CAPTION = "Press Run to watch seven agents work.";

interface Derived {
  active: string | null;
  done: Set<string>;
  a2aCount: Record<string, number>;
  mcpCount: Record<string, number>;
  refusedByServer: Record<string, number>;
  last?: RunState["a2a"][number];
  lastCall?: RunState["mcp"][number];
  caption: string;
  summary: string;
}

function derive(s: RunState): Derived {
  const tasks: Record<string, Set<string>> = {};
  for (const r of s.a2a) {
    // Count replies: each carries the real task id. The worker that replied handled the task;
    // the Conductor is credited with every task it delegated.
    if (r.state === "TASK_STATE_SUBMITTED") continue;
    (tasks[r.from] ??= new Set()).add(r.taskId);
    if (r.to === "conductor") (tasks.conductor ??= new Set()).add(r.taskId);
  }
  const a2aCount = Object.fromEntries(Object.entries(tasks).map(([k, v]) => [k, v.size]));
  const mcpCount: Record<string, number> = {};
  const refusedByServer: Record<string, number> = {};
  for (const c of s.mcp) {
    mcpCount[c.agent] = (mcpCount[c.agent] ?? 0) + 1;
    if (!c.allowed) refusedByServer[c.server] = (refusedByServer[c.server] ?? 0) + 1;
  }
  const last = s.a2a[s.a2a.length - 1];
  const lastCall = s.mcp[s.mcp.length - 1];
  const running = [...s.steps].reverse().find((x) => x.status === "running");
  let active: string | null = running?.agent ?? last?.to ?? null;
  if (s.status === "awaiting") active = "human";
  if (!s.steps.length) active = null;

  const byAgent: Record<string, string[]> = {};
  for (const st of s.steps) (byAgent[st.agent] ??= []).push(st.status);
  const done = new Set(Object.entries(byAgent).filter(([id, sts]) => id !== active && sts.every((x) => x === "done")).map(([id]) => id));

  const caption = !s.steps.length
    ? IDLE_CAPTION
    : last
      ? `${label(last.from)} → ${label(last.to)} · ${last.skill} · ${last.summary}`
      : `${label(active ?? "conductor")} is working.`;
  const refused = s.mcp.filter((c) => !c.allowed).length;
  const summary = !s.steps.length
    ? "Agent mesh at rest: Conductor with six workers, seven MCP servers and two human approvers."
    : `Agent mesh, ${s.status}. Active: ${active ? label(active) : "none"}. ${s.a2a.length} A2A messages, ${s.mcp.length} MCP calls, ${refused} refused.${s.objections.length ? ` ${s.objections.length} Validator objection(s) sent to the Author.` : ""}${s.rollbacks.length ? ` ${s.rollbacks.length} rollback(s).` : ""}`;
  return { active, done, a2aCount, mcpCount, refusedByServer, last, lastCall, caption, summary };
}

function Counters({ a2a, mcp, tone }: { a2a: number; mcp: number; tone: "on" | "off" }) {
  return (
    <span className={`num block text-[10.5px] leading-tight ${tone === "on" ? "text-white" : "text-muted"}`}>
      {a2a} A2A · {mcp} MCP
    </span>
  );
}

function AgentNode({ id, d, sub }: { id: string; d: Derived; sub?: string }) {
  const on = d.active === id;
  return (
    <div className={`relative px-2 py-1.5 transition-colors duration-300 ${on ? "bg-accent text-white" : id === "conductor" ? "bg-navy text-white" : "bg-surface text-ink"}`}>
      {d.done.has(id) && <span className="absolute right-1 top-1 h-2 w-2 bg-ok" title="Finished" />}
      <span className="block truncate pr-2 text-[13px] font-semibold leading-tight">{label(id)}</span>
      {sub ? (
        <span className={`block truncate text-[10.5px] leading-tight ${on || id === "conductor" ? "text-white" : "text-muted"}`}>{sub}</span>
      ) : (
        <Counters a2a={d.a2aCount[id] ?? 0} mcp={d.mcpCount[id] ?? 0} tone={on || id === "conductor" ? "on" : "off"} />
      )}
    </div>
  );
}

function ServerNode({ name, d, flashKey }: { name: string; d: Derived; flashKey: number }) {
  const hit = d.lastCall?.server === name;
  const refused = hit && !d.lastCall!.allowed;
  const total = d.refusedByServer[name] ?? 0;
  return (
    <div className="relative bg-bg px-1 py-1 text-center outline outline-1 outline-surface-2">
      <span className="block truncate text-[11px] font-semibold leading-tight text-ink">{name}</span>
      <span className={`num block text-[10px] leading-tight ${total ? "text-bad" : "text-muted"}`}>{total ? `${total} refused` : "MCP"}</span>
      {hit && (
        <span key={flashKey} className={`mesh-flash absolute inset-0 flex flex-col items-center justify-center text-[11px] font-semibold ${refused ? "bg-bad-soft text-bad" : "bg-accent text-white"}`}>
          <span className="block max-w-full truncate px-1">{refused ? "refused" : d.lastCall!.tool}</span>
        </span>
      )}
    </div>
  );
}

export function AgentMesh({ s }: { s: RunState }) {
  const d = useMemo(() => derive(s), [s]);
  const flashKey = s.mcp.length;
  const objection = s.objections.length > 0;
  const last = d.last;
  const pulse = useMemo(() => {
    if (!last || !s.steps.length) return null;
    const a = POS[last.from];
    const b = POS[last.to];
    if (!a || !b) return null;
    return { a, b, bad: last.skill === "resolve-objection" || last.state === "TASK_STATE_REJECTED" || last.state === "TASK_STATE_FAILED" };
  }, [last, s.steps.length]);
  const callEdge = d.lastCall && POS[d.lastCall.agent] ? ([POS[d.lastCall.agent], POS[`mcp:${d.lastCall.server}`]] as const) : null;

  const pct = (id: string) => ({ left: `${(POS[id][0] / W) * 100}%`, top: `${(POS[id][1] / H) * 100}%` });

  return (
    <div data-ui className="@container bg-bg">
      <style>{CSS}</style>
      <div role="img" aria-label={d.summary}>
        {/* Wide stage */}
        <div className="relative hidden w-full @2xl:block" style={{ aspectRatio: `${W} / ${H}` }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
            {MCP_EDGES.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={POS[a][0]} y1={POS[a][1]} x2={POS[b][0]} y2={POS[b][1]} stroke="var(--surface-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {WORKERS.map((w) => (
              <line key={w.id} x1={POS.conductor[0]} y1={POS.conductor[1]} x2={POS[w.id][0]} y2={POS[w.id][1]} stroke={d.active === w.id ? "var(--accent)" : "var(--soft)"} strokeWidth={d.active === w.id ? 2.5 : 1.25} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={POS.validator[0]} y1={POS.validator[1]} x2={POS.author[0]} y2={POS.author[1]} stroke={objection ? "var(--bad)" : "var(--soft)"} strokeWidth={objection ? 2.5 : 1.25} strokeDasharray={objection ? undefined : "4 4"} vectorEffect="non-scaling-stroke" />
            <line x1={POS.release[0]} y1={POS.release[1]} x2={POS.human[0]} y2={POS.human[1]} stroke={d.active === "human" ? "var(--accent)" : "var(--soft)"} strokeWidth={d.active === "human" ? 2.5 : 1.25} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            {callEdge && callEdge[1] && (
              <line key={`call-${flashKey}`} className="mesh-flash" x1={callEdge[0][0]} y1={callEdge[0][1]} x2={callEdge[1][0]} y2={callEdge[1][1]} stroke={d.lastCall!.allowed ? "var(--accent)" : "var(--bad)"} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            )}
            {pulse && (
              <>
                <line x1={pulse.a[0]} y1={pulse.a[1]} x2={pulse.b[0]} y2={pulse.b[1]} stroke={pulse.bad ? "var(--bad)" : "var(--accent)"} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                <circle
                  key={`dot-${s.a2a.length}`}
                  className="mesh-dot"
                  r={8}
                  fill={pulse.bad ? "var(--bad)" : "var(--accent)"}
                  style={{ "--x1": `${pulse.a[0]}px`, "--y1": `${pulse.a[1]}px`, "--x2": `${pulse.b[0]}px`, "--y2": `${pulse.b[1]}px`, transform: `translate(${pulse.a[0]}px, ${pulse.a[1]}px)` } as React.CSSProperties}
                />
              </>
            )}
          </svg>
          {["conductor", ...WORKERS.map((w) => w.id)].map((id) => (
            <div key={id} className="absolute w-[15%] max-w-[150px] -translate-x-1/2 -translate-y-1/2" style={pct(id)}>
              <AgentNode id={id} d={d} />
            </div>
          ))}
          <div className="absolute w-[15%] max-w-[150px] -translate-x-1/2 -translate-y-1/2" style={pct("human")}>
            <AgentNode id="human" d={d} sub={s.approvals.length ? `${s.approvals.length} signatures` : "2 approvers"} />
          </div>
          {SERVERS.map((sv) => (
            <div key={sv} className="absolute w-[12.6%] -translate-x-1/2 -translate-y-1/2" style={pct(`mcp:${sv}`)}>
              <ServerNode name={sv} d={d} flashKey={flashKey} />
            </div>
          ))}
          <span className="ui absolute left-0 text-[11px] text-muted" style={{ top: `${(488 / H) * 100}%` }}>
            MCP servers
          </span>
        </div>

        {/* Compact vertical stage */}
        <div className="@2xl:hidden">
          <AgentNode id="conductor" d={d} />
          <ol className="m-0 ml-3 border-l-2 border-surface-2 p-0">
            {[...WORKERS.map((w) => w.id), "human"].map((id) => {
              const incoming = pulse && last?.to === id;
              const objectionHere = objection && (id === "author" || id === "validator");
              return (
                <li key={id} className="relative list-none py-1 pl-4">
                  <span className={`absolute left-0 top-1/2 h-[2px] w-4 ${incoming ? (pulse!.bad ? "bg-bad" : "bg-accent") : objectionHere ? "bg-bad" : "bg-surface-2"}`} />
                  <div className="flex items-stretch gap-2">
                    <div className="min-w-0 flex-1">
                      <AgentNode id={id} d={d} sub={id === "human" ? (s.approvals.length ? `${s.approvals.length} signatures` : "2 approvers") : undefined} />
                    </div>
                    {incoming && (
                      <span className={`flex shrink-0 items-center px-2 text-[11px] font-semibold ${pulse!.bad ? "bg-bad-soft text-bad" : "bg-accent-soft text-accent"}`}>
                        <span className="pulse mr-1.5 inline-block h-2 w-2 bg-current" />
                        from {label(last!.from)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="ui mb-1 mt-3 text-[11px] text-muted">MCP servers</p>
          <div className="grid grid-cols-2 gap-1 @xs:grid-cols-3">
            {SERVERS.map((sv) => (
              <ServerNode key={sv} name={sv} d={d} flashKey={flashKey} />
            ))}
          </div>
        </div>
      </div>

      <p className={`ui mt-3 truncate px-3 py-2 text-[13px] ${pulse?.bad ? "bg-bad-soft text-bad" : "bg-surface text-ink"}`} aria-hidden="true" title={d.caption}>
        {d.caption}
      </p>
      <p className="sr-only" aria-live="polite">
        {d.caption}
      </p>
    </div>
  );
}
