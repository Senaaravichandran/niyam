"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* ---------- data ---------- */

interface GNode {
  id: string;
  label: string;
  props: Record<string, unknown>;
}
interface GEdge {
  from: string;
  to: string;
  type: string;
  props?: Record<string, unknown>;
}
interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  stats: { nodes: number; edges: number; labels: Record<string, number> };
}

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: GraphData };

const DEFAULT_NODE = "CL-017-4b";

const COLUMNS: { title: string; labels: string[] }[] = [
  { title: "Regulator", labels: ["Regulator"] },
  { title: "Circular", labels: ["Circular"] },
  { title: "Clause", labels: ["Clause"] },
  { title: "Obligation", labels: ["Obligation"] },
  { title: "Policy and metric", labels: ["Policy", "Metric"] },
  { title: "Rule", labels: ["Rule"] },
  { title: "Rule version", labels: ["RuleVersion"] },
];

const LABEL_NAME: Record<string, string> = { RuleVersion: "Rule version" };

/* ---------- layout ---------- */

const W = 140;
const H = 46;
const ROW_GAP = 12;
const COL_GAP = 64;
const HEADER = 30;
const PAD = 4;

interface Placed {
  node: GNode;
  col: number;
  x: number;
  y: number;
}

function layout(nodes: GNode[]) {
  const cols: { title: string; labels: string[] }[] = [...COLUMNS];
  const known = new Set(cols.flatMap((c) => c.labels));
  const extra = [...new Set(nodes.map((n) => n.label).filter((l) => !known.has(l)))];
  if (extra.length) cols.push({ title: "Other", labels: extra });

  const buckets = cols.map((c) =>
    nodes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => c.labels.includes(n.label))
      .sort((a, b) => c.labels.indexOf(a.n.label) - c.labels.indexOf(b.n.label) || a.i - b.i)
      .map(({ n }) => n),
  );
  const tallest = Math.max(1, ...buckets.map((b) => b.length));
  const bodyH = tallest * (H + ROW_GAP) - ROW_GAP;
  const pos = new Map<string, Placed>();
  buckets.forEach((bucket, col) => {
    const colH = bucket.length * (H + ROW_GAP) - ROW_GAP;
    const top = HEADER + (bodyH - colH) / 2;
    bucket.forEach((node, row) => {
      pos.set(node.id, { node, col, x: PAD + col * (W + COL_GAP), y: top + row * (H + ROW_GAP) });
    });
  });
  const width = PAD * 2 + cols.length * W + (cols.length - 1) * COL_GAP + 40;
  const height = HEADER + bodyH + PAD;
  return { cols, pos, width, height };
}

function edgePath(a: Placed, b: Placed) {
  const y1 = a.y + H / 2;
  const y2 = b.y + H / 2;
  if (a.col === b.col) {
    const x = a.x + W;
    return `M ${x} ${y1} C ${x + 44} ${y1}, ${x + 44} ${y2}, ${x} ${y2}`;
  }
  const forward = a.col < b.col;
  const x1 = forward ? a.x + W : a.x;
  const x2 = forward ? b.x : b.x + W;
  const dx = Math.max(24, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** Edges lit by a selection: 1-hop, extended along the Golden Thread for clauses and obligations. */
function litEdges(edges: GEdge[], nodes: Map<string, GNode>, id: string | null): Set<number> {
  const lit = new Set<number>();
  if (!id) return lit;
  edges.forEach((e, i) => {
    if (e.from === id || e.to === id) lit.add(i);
  });
  const label = nodes.get(id)?.label;
  if (label === "Clause") {
    const obligations = edges.filter((e) => e.type === "DERIVED_FROM" && e.to === id).map((e) => e.from);
    edges.forEach((e, i) => {
      if (obligations.includes(e.from) && (e.type === "MAPPED_TO" || e.type === "CONFLICTS_WITH")) lit.add(i);
    });
  }
  if (label === "Obligation") {
    const clauses = edges.filter((e) => e.type === "DERIVED_FROM" && e.from === id).map((e) => e.to);
    edges.forEach((e, i) => {
      if (e.type === "CONTAINS" && clauses.includes(e.to)) lit.add(i);
    });
  }
  return lit;
}

/* ---------- small pieces ---------- */

const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v));

function shortId(n: GNode) {
  if (n.label === "Clause" && n.props.number) return `para ${str(n.props.number)}`;
  return n.id;
}

function Spans({ text, spans }: { text: string; spans: string[] }) {
  const ranges: [number, number][] = [];
  for (const s of spans) {
    if (!s) continue;
    const i = text.indexOf(s);
    if (i >= 0) ranges.push([i, i + s.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: React.ReactNode[] = [];
  let at = 0;
  merged.forEach(([s, e], i) => {
    if (s > at) out.push(text.slice(at, s));
    out.push(
      <mark key={i} className="bg-accent-soft px-0.5 text-ink">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="m-0 min-w-0 break-words text-ink">{children}</dd>
    </>
  );
}

function Tag({ tone = "muted", children }: { tone?: "muted" | "ok" | "bad" | "accent" | "navy"; children: React.ReactNode }) {
  const cls = {
    muted: "bg-surface-2 text-muted",
    ok: "bg-ok-soft text-ok",
    bad: "bg-bad-soft text-bad",
    accent: "bg-accent-soft text-accent",
    navy: "bg-navy text-on-navy",
  }[tone];
  return <span className={`ui inline-block whitespace-nowrap px-2 py-0.5 text-[11.5px] font-semibold ${cls}`}>{children}</span>;
}

/* ---------- detail panel ---------- */

function Details({ node, data, onSelect }: { node: GNode; data: GraphData; onSelect: (id: string) => void }) {
  const p = node.props;
  const serif = { fontFamily: "var(--font-text)" } as const;
  let body: React.ReactNode;

  switch (node.label) {
    case "Clause": {
      const spans = data.nodes.filter((n) => n.label === "Obligation" && n.props.clauseId === node.id).map((n) => str(n.props.span));
      const applies = p.applicability === "applies";
      body = (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-ink">Para {str(p.number)}</span>
            <Tag tone={applies ? "ok" : "muted"}>{applies ? "Applies" : str(p.applicability).replace("_", " ")}</Tag>
          </div>
          <p className="mt-2 text-[15px] leading-[1.6] text-ink" style={serif}>
            <Spans text={str(p.text)} spans={spans} />
          </p>
          {spans.length > 0 && <p className="mt-1 text-[12px] text-muted">Highlighted: {spans.length} verified obligation span{spans.length > 1 ? "s" : ""}</p>}
          {p.reason != null && <p className="mt-2 text-[12.5px] text-muted">{str(p.reason)}</p>}
        </>
      );
      break;
    }
    case "Obligation":
      body = (
        <>
          <p className="text-[15px] leading-[1.6] text-ink" style={serif}>
            “{str(p.span)}”
          </p>
          <dl className="mt-3 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-[13px]">
            <Row k="Kind">
              {str(p.kind)} · {str(p.modality).replace("_", " ")}
            </Row>
            {p.metric != null ? (
              <Row k="Fires when">
                <span className="code">{str(p.metric)}</span> <b>{str(p.operator)}</b> {str(p.threshold)}
                {p.unit === "pct" ? "%" : p.unit ? ` ${str(p.unit)}` : ""}
              </Row>
            ) : (
              <Row k="Action">{str(p.action).replace("_", " ")}</Row>
            )}
            <Row k="Clause">para {str(p.clauseNumber)}</Row>
            <Row k="Effective">{str(p.effectiveFrom)}</Row>
            {Array.isArray(p.scope) && <Row k="Scope">{(p.scope as unknown[]).map(str).join(", ")}</Row>}
            {p.spanStart != null && (
              <Row k="Verified">
                <span className="text-ok">
                  chars {str(p.spanStart)} to {str(p.spanEnd)}
                </span>{" "}
                · {str(p.extractedBy)}
              </Row>
            )}
          </dl>
        </>
      );
      break;
    case "Policy":
      body = (
        <>
          <p className="text-[13px] text-muted">
            {str(p.policy)} · section {str(p.section)}
          </p>
          <p className="mt-2 text-[15px] leading-[1.6] text-ink" style={serif}>
            {str(p.text)}
          </p>
          {p.permits != null && (
            <dl className="mt-3 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-[13px]">
              {typeof p.permits === "object" ? (
                Object.entries(p.permits as Record<string, unknown>).map(([k, v]) => (
                  <Row key={k} k={k}>
                    {str(v)}
                  </Row>
                ))
              ) : (
                <Row k="Permits">{str(p.permits)}</Row>
              )}
            </dl>
          )}
        </>
      );
      break;
    case "Rule":
      body = (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-ink">{p.title ? str(p.title) : node.id}</span>
            {p.proposed === true && <Tag tone="accent">Proposed new rule</Tag>}
          </div>
          <dl className="mt-3 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-[13px]">
            <Row k="Rule id">{node.id}</Row>
            {p.metric != null && (
              <Row k="Metric">
                <span className="code">{str(p.metric)}</span>
              </Row>
            )}
          </dl>
        </>
      );
      break;
    case "Metric":
      body = (
        <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-[13px]">
          <Row k="Label">{str(p.label)}</Row>
          <Row k="Metric id">
            <span className="code">{node.id}</span>
          </Row>
          {p.physical != null && (
            <Row k="Physical">
              <span className="code">{str(p.physical)}</span>
            </Row>
          )}
        </dl>
      );
      break;
    default:
      body = (
        <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-[13px]">
          {Object.entries(p).map(([k, v]) => (
            <Row key={k} k={k}>
              {str(v)}
            </Row>
          ))}
        </dl>
      );
  }

  const links = data.edges.filter((e) => e.from === node.id || e.to === node.id);
  return (
    <div>
      <p className="text-[12px] text-muted">{LABEL_NAME[node.label] ?? node.label}</p>
      <p className="code mb-3 break-all text-[12.5px] text-ink">{node.id}</p>
      {body}
      {links.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-[12px] text-muted">Connections</p>
          <ul className="m-0 p-0">
            {links.map((e, i) => {
              const out = e.from === node.id;
              const other = out ? e.to : e.from;
              const conflict = e.type === "CONFLICTS_WITH";
              return (
                <li key={i} className="list-none">
                  <button
                    type="button"
                    onClick={() => onSelect(other)}
                    className="flex w-full cursor-pointer items-baseline gap-2 bg-transparent px-1 py-1 text-left text-[12.5px] transition-colors hover:bg-surface-2"
                  >
                    <span className={`shrink-0 font-semibold ${conflict ? "text-bad" : "text-muted"}`}>
                      {out ? "" : "← "}
                      {e.type}
                      {out ? " →" : ""}
                    </span>
                    <span className="min-w-0 truncate text-ink">{other}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- panel ---------- */

export function GraphPanel() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setLoad({ status: "loading" });
    fetch("/api/graph", { signal: ac.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body as GraphData;
      })
      .then((data) => {
        setLoad({ status: "ready", data });
        const fallback = data.nodes.find((n) => n.label === "Clause")?.id ?? null;
        setSelected(data.nodes.some((n) => n.id === DEFAULT_NODE) ? DEFAULT_NODE : fallback);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoad({ status: "error", message: e.message });
      });
    return () => ac.abort();
  }, [attempt]);

  const data = load.status === "ready" ? load.data : null;
  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);
  const geo = useMemo(() => layout(data?.nodes ?? []), [data]);
  const lit = useMemo(() => litEdges(data?.edges ?? [], byId, selected), [data, byId, selected]);
  const litNodes = useMemo(() => {
    const s = new Set<string>();
    if (selected) s.add(selected);
    for (const i of lit) {
      const e = data!.edges[i];
      s.add(e.from);
      s.add(e.to);
    }
    return s;
  }, [lit, selected, data]);
  const conflictNodes = useMemo(() => {
    const s = new Set<string>();
    for (const i of lit) {
      const e = data!.edges[i];
      if (e.type === "CONFLICTS_WITH") s.add(e.to);
    }
    return s;
  }, [lit, data]);

  const select = useCallback((id: string) => setSelected((cur) => (cur === id ? null : id)), []);

  if (load.status === "loading") {
    return (
      <div data-ui className="bg-surface px-4 py-6 text-[14px] text-muted" role="status" aria-live="polite">
        <span className="pulse mr-2 inline-block h-2 w-2 bg-accent align-middle" />
        Building the knowledge graph from a synthetic run…
      </div>
    );
  }
  if (load.status === "error") {
    return (
      <div data-ui className="flex flex-wrap items-center justify-between gap-3 bg-bad-soft px-4 py-4 text-[14px] text-bad" role="alert">
        <span>Could not load the graph: {load.message}</span>
        <button type="button" className="btn btn-quiet !px-3 !py-1.5 !text-[13px]" onClick={() => setAttempt((a) => a + 1)}>
          Retry
        </button>
      </div>
    );
  }

  const g = load.data;
  const sel = selected ? byId.get(selected) : undefined;
  const order = g.edges.map((e, i) => ({ e, i })).sort((a, b) => Number(lit.has(a.i)) - Number(lit.has(b.i)));
  const hasSel = Boolean(sel);

  return (
    <div
      data-ui
      className="min-w-0"
      onKeyDown={(e) => {
        if (e.key === "Escape" && selected) setSelected(null);
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="ui num text-[13px] text-muted">
          {g.stats.nodes} nodes · {g.stats.edges} edges · one proposal run of the synthetic circular
        </p>
        <span className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
          <span className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" stroke="var(--ink)" strokeWidth="1.5" />
            </svg>
            Relationship
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" stroke="#b91c1c" strokeWidth="2" strokeDasharray="5 3" />
            </svg>
            CONFLICTS_WITH
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 bg-accent" /> Selected
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 bg-accent-soft" /> Connected
          </span>
          <Tag tone="navy">Synthetic</Tag>
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 max-w-full overflow-x-auto bg-surface">
          <div className="relative" style={{ width: geo.width, height: geo.height + 16, margin: 8 }} role="group" aria-label="Knowledge graph, columns from regulator to rule version">
            {geo.cols.map((c, i) => (
              <p key={c.title} className="absolute text-[11.5px] font-semibold text-muted" style={{ left: PAD + i * (W + COL_GAP), top: 0, width: W }}>
                {c.title}
              </p>
            ))}

            <svg className="pointer-events-none absolute left-0 top-0" width={geo.width} height={geo.height} aria-hidden="true">
              <defs>
                {[
                  ["ink", "var(--ink)"],
                  ["soft", "var(--soft)"],
                  ["bad", "#b91c1c"],
                ].map(([k, c]) => (
                  <marker key={k} id={`kg-arrow-${k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0 0 L8 4 L0 8 z" fill={c} />
                  </marker>
                ))}
              </defs>
              {order.map(({ e, i }) => {
                const a = geo.pos.get(e.from);
                const b = geo.pos.get(e.to);
                if (!a || !b) return null;
                const on = lit.has(i);
                const conflict = e.type === "CONFLICTS_WITH";
                const tone = conflict ? "bad" : on ? "ink" : "soft";
                const stroke = conflict ? "#b91c1c" : on ? "var(--ink)" : "var(--soft)";
                return (
                  <path
                    key={i}
                    d={edgePath(a, b)}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={on ? (conflict ? 2.5 : 2) : 1.25}
                    strokeDasharray={conflict ? "6 4" : undefined}
                    markerEnd={`url(#kg-arrow-${tone})`}
                    opacity={!hasSel || on ? 1 : 0.18}
                    style={{ transition: "opacity 200ms" }}
                  />
                );
              })}
            </svg>

            {[...geo.pos.values()].map(({ node, x, y }) => {
              const isSel = node.id === selected;
              const isNear = !isSel && litNodes.has(node.id);
              const isConflict = isNear && conflictNodes.has(node.id);
              const dim = hasSel && !isSel && !isNear;
              const tone = isSel ? "bg-accent text-white" : isConflict ? "bg-bad-soft text-bad" : isNear ? "bg-accent-soft text-ink" : "bg-bg text-ink hover:bg-surface-2";
              return (
                <button
                  key={node.id}
                  type="button"
                  aria-pressed={isSel}
                  title={node.id}
                  onClick={() => select(node.id)}
                  className={`ui absolute flex cursor-pointer flex-col justify-center overflow-hidden px-2 text-left transition-[opacity,background-color] duration-200 ${tone} ${dim ? "opacity-35" : "opacity-100"}`}
                  style={{ left: x, top: y, width: W, height: H }}
                >
                  <span className={`block text-[10.5px] leading-tight ${isSel ? "text-on-navy" : isConflict ? "text-bad" : "text-muted"}`}>{LABEL_NAME[node.label] ?? node.label}</span>
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">{shortId(node)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="min-w-0 bg-surface p-4" aria-live="polite" aria-label="Selected node">
          {sel ? (
            <Details node={sel} data={g} onSelect={(id) => setSelected(id)} />
          ) : (
            <p className="text-[13.5px] text-muted">Select a node to see its properties and connections. Press Escape to clear.</p>
          )}
        </aside>
      </div>
      <p className="mt-2 text-[12px] text-muted">
        Selecting a clause lights its obligations and where they land: para 4(b) runs to SYN-EXP-012 and conflicts with policy section POL-CR-07-7.2.
      </p>
    </div>
  );
}
