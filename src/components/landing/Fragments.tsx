/**
 * Cropped, true-size fragments of the NIYAM interface. Every value shown comes from the real run
 * on the synthetic circular RBI-SYN-2026-017 (see `npm run demo`).
 */

const CLAUSE_4B =
  "A regulated entity shall flag for report any group of connected counterparties with an aggregate exposure exceeding 12 per cent of Tier 1 capital.";
const SPAN_4B = "aggregate exposure exceeding 12 per cent of Tier 1 capital";

export function Synthetic({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span
      className={`ui inline-block px-1.5 py-0.5 text-[11px] font-semibold ${tone === "dark" ? "bg-navy-2 text-on-navy-muted" : "bg-surface-2 text-muted"}`}
    >
      Synthetic
    </span>
  );
}

function Head({ left, right }: { left: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-surface-2 px-4 py-2.5 text-[12.5px] text-muted" /* taste-skill-ignore: interface fragment chrome (data-ui) */>
      <span className="truncate">{left}</span>
      {right ?? <Synthetic />}
    </div>
  );
}

export function ClauseFragment() {
  const i = CLAUSE_4B.indexOf(SPAN_4B);
  return (
    <div data-ui className="h-full bg-bg">
      <Head left="RBI-SYN-2026-017 · para 4(b) · applies to UCB" />
      <div className="p-4 sm:p-5">
        <p className="text-[15px] leading-[1.6] text-ink" style={{ fontFamily: "var(--font-text)" }}>
          <span className="ui mr-2 font-bold">(b)</span>
          {CLAUSE_4B.slice(0, i)}
          <mark className="bg-accent-soft px-0.5 text-ink">
            aggregate exposure <span className="underline decoration-accent decoration-2 underline-offset-4">exceeding</span> 12 per cent of Tier 1 capital
          </mark>
          {CLAUSE_4B.slice(i + SPAN_4B.length)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
          <span className="bg-ok-soft px-2 py-1 text-ok">Applies: scope includes UCB</span>
          <span className="bg-surface px-2 py-1 text-muted">Effective 1 Dec 2026</span>
        </div>
      </div>
    </div>
  );
}

export function ObligationFragment() {
  const rows: [string, React.ReactNode][] = [
    ["Obligation", "OBL-017-4b"],
    ["Metric", "group_exposure_pct_tier1"],
    ["Fires when", <span key="op" className="font-semibold">&gt; 12 pct</span>],
    ["Comparator", "“exceeding”: strictly greater, equality does not trigger"],
    ["Source span", <span key="span" className="text-ok">Exact substring of 4(b), characters 87 to 145</span>],
  ];
  return (
    <div data-ui className="h-full bg-bg">
      <Head left="Extractor · typed obligation" />
      <dl className="m-0 grid grid-cols-[112px_1fr] gap-x-3 gap-y-2 p-4 text-[13.5px] sm:p-5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="m-0 text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function RuleDiffFragment() {
  const lines: [string, string][] = [
    [" ", "rule_id: SYN-EXP-012"],
    [" ", "version: 2"],
    [" ", "when:"],
    [" ", "  metric: group_exposure_pct_tier1"],
    ["-", '  op: ">="'],
    ["+", '  op: ">"'],
    [" ", "  value: 12"],
    ["-", "unless: board_approved"],
    [" ", "action: flag_for_report"],
  ];
  return (
    <div data-ui className="h-full bg-bg">
      <Head left="draft/RBI-SYN-2026-017 · SYN-EXP-012.yaml" right={<span className="text-ok">Objection resolved</span>} />
      <pre className="m-0 overflow-hidden p-0 py-2 text-[12.5px]">
        {lines.map(([sign, text], idx) => (
          <div
            key={idx}
            className={`px-4 ${sign === "-" ? "bg-bad-soft text-bad" : sign === "+" ? "bg-ok-soft text-ok" : "text-ink"}`}
          >
            <span className="mr-3 inline-block w-2 select-none opacity-70">{sign}</span>
            {text}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function BoundaryFragment() {
  const tests: [string, string, boolean, boolean][] = [
    ["Just below the limit", "11.99%", false, false],
    ["Exactly on the limit", "12.00%", false, false],
    ["Just above the limit", "12.01%", true, true],
    ["Board approval does not suppress", "14.00%", true, true],
  ];
  return (
    <div data-ui className="h-full bg-bg">
      <Head left="Validator · tests generated from para 4(b)" right={<span className="font-semibold text-ok">14 / 14 pass</span>} />
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-4 py-2 font-normal">Case</th>
            <th className="px-2 py-2 font-normal">Input</th>
            <th className="px-4 py-2 text-right font-normal">Result</th>
          </tr>
        </thead>
        <tbody>
          {tests.map(([name, input, expect, fired], i) => (
            <tr key={name} className={i === 1 ? "bg-accent-soft" : ""}>
              <td className="px-4 py-1.5 text-ink">{name}</td>
              <td className="num px-2 py-1.5 text-ink">{input}</td>
              <td className="px-4 py-1.5 text-right">
                <span className="text-ok">
                  {fired ? "fires" : "quiet"} · {expect === fired ? "pass" : "fail"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const HERO_FRAMES = [
  { key: "clause", label: "The clause, with the span the rule will cite", node: <ClauseFragment /> },
  { key: "obligation", label: "A typed obligation whose span is verified, never trusted", node: <ObligationFragment /> },
  { key: "rule", label: "The rule draft after the Validator's objection", node: <RuleDiffFragment /> },
  { key: "tests", label: "Tests written from the regulation, not from the draft", node: <BoundaryFragment /> },
];
