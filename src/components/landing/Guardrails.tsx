"use client";

import { useMemo, useState } from "react";
import { REPO_URL } from "@/content/site";

const ITEMS = [
  {
    name: "Draft-only branches",
    key: "D",
    line: "Agents can commit only to draft/* branches. Main moves by fast-forward after two valid signatures.",
    attempt: "Author tries to commit straight to main",
    outcome: "Refused: agents may only commit to draft/* branches",
    file: "src/niyam/git/repo.ts",
  },
  {
    name: "Exact-span verification",
    key: "S",
    line: "Every obligation quotes its clause. If the quote is not an exact substring of the clause, the obligation is rejected, never repaired.",
    attempt: "A model paraphrases “exceeding 12 per cent”",
    outcome: "Rejected: span is not an exact substring of the clause",
    file: "src/niyam/agents/extractor.ts",
  },
  {
    name: "Tests from the clause",
    key: "T",
    line: "Boundary tests are generated from the obligation, not from the draft, so a rule that misreads “exceeding” fails at exactly 12.00%.",
    attempt: "Draft fires on >= 12",
    outcome: "Objection: “Exactly on the limit” expected quiet, rule fired",
    file: "src/niyam/dsl/testgen.ts",
  },
  {
    name: "Two-person signature",
    key: "2",
    line: "HMAC tokens from two people in two roles, bound to the SHA-256 of the exact rule file and to the run. One changed byte voids both.",
    attempt: "Edit the limit from 12 to 13 after signing",
    outcome: "Refused: rule file changed after approval",
    file: "src/niyam/approvals/token.ts",
  },
  {
    name: "Shadow, canary, live",
    key: "R",
    line: "New rules log silently for three days, then act on 10% of subjects behind a feature flag, then go live.",
    attempt: "Release a rule straight to every customer",
    outcome: "Not possible: rollout always starts in shadow mode",
    file: "src/niyam/agents/release.ts",
  },
  {
    name: "Sentinel rollback",
    key: "B",
    line: "Each day is compared with the backtest forecast band. A breach turns the flag off and writes a git revert to the last approved version.",
    attempt: "Loan feed loads twice on rollout day 10",
    outcome: "Rolled back: 12 alerts against a band of 3.2 to 9.0",
    file: "src/niyam/mcp/servers.ts",
  },
  {
    name: "Least-privilege tools",
    key: "L",
    line: "Each Agent Card lists the MCP tools that agent may call. Its client refuses the rest, and every server checks again.",
    attempt: "Extractor calls the deploy API",
    outcome: "Denied twice: by its MCP client and by the server",
    file: "src/niyam/mcp/allowlist.ts",
  },
  {
    name: "Untrusted circular text",
    key: "U",
    line: "Circular text is passed as data inside a marked block, never as instructions, and every model output must match a schema.",
    attempt: "A circular hides “ignore your instructions”",
    outcome: "Treated as text: outputs still span-checked and schema-checked",
    file: "src/niyam/llm/claude.ts",
  },
];

type Item = (typeof ITEMS)[number];

function Detail({ item }: { item: Item }) {
  return (
    <div key={item.name} className="rise">
      <p className="text-[19px] leading-[1.55] text-ink">{item.line}</p>
      <dl className="ui mt-6 grid gap-px bg-surface-2 text-[15px]">
        <div className="bg-bg px-4 py-3">
          <dt className="text-[13px] text-muted">If someone tries</dt>
          <dd className="m-0 mt-0.5 text-ink">{item.attempt}</dd>
        </div>
        <div className="bg-bg px-4 py-3">
          <dt className="text-[13px] text-muted">NIYAM responds</dt>
          <dd className="m-0 mt-0.5 font-semibold text-bad">{item.outcome}</dd>
        </div>
        <div className="bg-bg px-4 py-3">
          <dt className="text-[13px] text-muted">Enforced in</dt>
          <dd className="m-0 mt-0.5">
            <a href={`${REPO_URL}/blob/main/${item.file}`} className="code link text-[13px] text-ink">
              {item.file}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function Guardrails() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const list = useMemo(() => ITEMS.filter((i) => `${i.name} ${i.line}`.toLowerCase().includes(q.toLowerCase())), [q]);
  const current = Math.min(sel, Math.max(0, list.length - 1));
  const active = list[current];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((x) => Math.min(list.length - 1, x + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((x) => Math.max(0, x - 1));
    } else if ((e.target as HTMLElement).tagName !== "INPUT") {
      const k = list.findIndex((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (k >= 0) setSel(k);
    }
  };

  return (
    <section className="wrap py-28 lg:py-36" aria-labelledby="guard-title" onKeyDown={onKey}>
      <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 id="guard-title" data-reveal className="text-[clamp(32px,3.4vw,52px)]">
            Eight guardrails, enforced in code
          </h2>
          <p data-reveal style={{ ["--i" as string]: 1 }} className="mt-5 max-w-[46ch] text-[18px] text-ink">
            Not promises in a prompt: each one is a check that runs on every circular, and each one can be tried on the live console.
          </p>

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
            placeholder="Find a guardrail"
            autoComplete="off"
            className="ui mt-9 block h-12 w-full bg-surface px-4 text-[16px] text-ink outline-none transition-colors placeholder:text-muted focus:bg-surface-2"
          />

          <ul className="m-0 mt-3 p-0" role="listbox" aria-label="Guardrails">
            {list.map((item, i) => {
              const on = i === current;
              return (
                <li key={item.name} className="list-none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    aria-keyshortcuts={item.key}
                    onClick={() => setSel(i)}
                    onMouseEnter={() => setSel(i)}
                    className={`ui flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition-colors duration-150 ${on ? "bg-accent text-white" : "bg-transparent text-ink hover:bg-surface"}`}
                  >
                    <span className="text-[clamp(20px,1.8vw,26px)] font-semibold tracking-[-0.02em]">{item.name}</span>
                    <kbd
                      aria-hidden
                      className={`ui hidden h-7 w-7 shrink-0 items-center justify-center text-[13px] font-semibold md:inline-flex ${on ? "bg-white/20 text-white" : "bg-surface text-muted"}`}
                    >
                      {item.key}
                    </kbd>
                  </button>
                  {on && (
                    <div className="px-4 pb-6 pt-4 lg:hidden">
                      <Detail item={item} />
                    </div>
                  )}
                </li>
              );
            })}
            {!list.length && <li className="ui list-none px-4 py-4 text-[16px] text-muted">No guardrail matches “{q}”.</li>}
          </ul>
          <p className="ui mt-4 hidden text-[13px] text-muted lg:block">Use the arrow keys or the letter shown to move between guardrails.</p>
        </div>

        <div className="hidden lg:col-span-7 lg:block">
          <div className="sticky top-28 bg-surface p-10" aria-live="polite">
            {active ? (
              <>
                <p className="ui text-[clamp(30px,2.8vw,42px)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">{active.name}</p>
                <div className="mt-6">
                  <Detail item={active} />
                </div>
              </>
            ) : (
              <p className="ui text-[18px] text-muted">Nothing matches your search.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
