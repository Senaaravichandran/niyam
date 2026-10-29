"use client";

import { useMemo, useState } from "react";

const ITEMS = [
  {
    name: "Draft-only branches",
    keys: "D",
    line: "Agents can commit only to draft/* branches. Main moves by fast-forward after two valid signatures, enforced in rule-repo code.",
  },
  {
    name: "Exact-span verification",
    keys: "S",
    line: "Every obligation quotes its clause. If the quote is not an exact substring, the obligation is rejected, never repaired.",
  },
  {
    name: "Tests from the clause",
    keys: "T",
    line: "Boundary tests are generated from the obligation, not the draft, so a rule that misreads “exceeding” fails at exactly 12.00%.",
  },
  {
    name: "Two-person signature",
    keys: "2",
    line: "HMAC tokens from two people in two roles, bound to the SHA-256 of the rule file. One changed byte voids both.",
  },
  {
    name: "Shadow, canary, live",
    keys: "R",
    line: "New rules log silently for three days, then act on 10% of subjects behind a flag, then go live.",
  },
  {
    name: "Sentinel rollback",
    keys: "B",
    line: "Each day is checked against the backtest forecast band. A breach turns the flag off and writes a revert commit.",
  },
  {
    name: "Least-privilege tools",
    keys: "L",
    line: "Each agent's card lists its MCP tools. The client refuses the rest and every server checks again.",
  },
  {
    name: "Untrusted circular text",
    keys: "U",
    line: "Circular text is passed as data inside a marked block, never as instructions, and outputs must match a schema.",
  },
];

export function Guardrails() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const list = useMemo(
    () => ITEMS.filter((i) => `${i.name} ${i.line}`.toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  const current = Math.min(sel, Math.max(0, list.length - 1));

  return (
    <section className="wrap py-28 lg:py-40" aria-labelledby="guard-title">
      <h2 id="guard-title" className="sr-only">
        Guardrails enforced in code
      </h2>
      <div
        data-ui
        className="!font-[inherit]"
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
          const k = list.findIndex((x) => x.keys.toLowerCase() === e.key.toLowerCase());
          if (k >= 0) setSel(k);
          if (e.key === "ArrowDown") setSel((x) => Math.min(list.length - 1, x + 1));
          if (e.key === "ArrowUp") setSel((x) => Math.max(0, x - 1));
        }}
      >
        <label htmlFor="guard-search" className="sr-only">
          Find a guardrail
        </label>
        <input
          id="guard-search"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(list.length - 1, s + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            }
          }}
          placeholder="Find a guardrail"
          autoComplete="off"
          className="ui block h-[1.9em] w-full bg-surface px-4 text-[clamp(22px,3vw,44px)] font-bold tracking-[-0.03em] text-ink outline-none placeholder:text-ink focus:bg-surface-2 lg:w-[83%]"
        />
        <ul className="m-0 mt-6 p-0" role="listbox" aria-label="Guardrails">
          {list.map((item, i) => {
            const on = i === current;
            return (
              <li
                key={item.name}
                role="option"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                aria-keyshortcuts={item.keys}
                onMouseEnter={() => setSel(i)}
                onClick={() => setSel(i)}
                className={`list-none cursor-pointer px-3 py-1 transition-colors duration-150 ${on ? "bg-accent text-white" : "text-ink"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="ui text-[clamp(30px,4.4vw,72px)] font-bold leading-[1.1] tracking-[-0.035em]">{item.name}</span>
                  <span className="hidden items-center gap-1.5 md:flex" aria-hidden>
                    <kbd className={`ui inline-flex h-[1.6em] w-[1.6em] items-center justify-center text-[20px] font-semibold ${on ? "bg-white/15" : "bg-surface"}`}>{item.keys}</kbd>
                  </span>
                </div>
                {on && <p className="ui rise max-w-[70ch] pb-3 pt-1 text-[17px] leading-[1.5] text-white">{item.line}</p>}
              </li>
            );
          })}
          {!list.length && <li className="ui list-none px-3 py-4 text-[20px] text-muted">No guardrail matches “{q}”.</li>}
        </ul>
      </div>
    </section>
  );
}
