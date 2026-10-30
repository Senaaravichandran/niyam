import type { Clause, Obligation, RejectedObligation } from "@/niyam/types";

export interface AnalyzeResult {
  ref: string;
  entityType: string;
  effectiveFrom: string;
  clauses: Clause[];
  obligations: (Obligation & { metricLabel?: string; operatorWhy?: string; ruleId?: string; noRuleReason?: string })[];
  rejected: RejectedObligation[];
  rules: {
    ruleId: string;
    obligationId: string;
    clauseNumber: string;
    yaml: string;
    tests: { id: string; name: string; given: string; expectFire: boolean; fired: boolean; pass: boolean }[];
  }[];
  path: "rule-based" | "llm";
  notes: string[];
}

function Tag({ tone, children }: { tone: "ok" | "bad" | "warn" | "muted"; children: React.ReactNode }) {
  const cls = { ok: "bg-ok-soft text-ok", bad: "bg-bad-soft text-bad", warn: "bg-warn-soft text-warn", muted: "bg-surface-2 text-muted" }[tone];
  return <span className={`ui inline-block whitespace-nowrap px-2 py-0.5 text-[13px] font-semibold ${cls}`}>{children}</span>;
}

/** Marks every verified span inside the clause text. Spans are exact substrings by construction. */
function Marked({ text, spans }: { text: string; spans: { start: number; end: number }[] }) {
  const ordered = spans.filter((s) => s.start >= 0 && s.end <= text.length).sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let at = 0;
  ordered.forEach((s, i) => {
    if (s.start < at) return;
    parts.push(text.slice(at, s.start));
    parts.push(
      <mark key={i} className="bg-accent-soft px-0.5 text-ink underline decoration-accent decoration-2 underline-offset-4">
        {text.slice(s.start, s.end)}
      </mark>,
    );
    at = s.end;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[clamp(26px,2.6vw,38px)]">
      {children}
    </h2>
  );
}

const APPLICABILITY: Record<Clause["applicability"], { label: string; tone: "ok" | "warn" | "muted" }> = {
  applies: { label: "Applies", tone: "ok" },
  not_applicable: { label: "Not applicable", tone: "warn" },
  informational: { label: "Informational", tone: "muted" },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function Results({ r }: { r: AnalyzeResult }) {
  const applies = r.clauses.filter((c) => c.applicability === "applies");
  const quantitative = r.obligations.filter((o) => o.kind === "quantitative");
  const allTests = r.rules.flatMap((x) => x.tests);
  const failed = allTests.filter((t) => !t.pass);
  const clauseById = new Map(r.clauses.map((c) => [c.id, c]));

  return (
    <div id="try-results" className="scroll-mt-20">
      <section className="bg-navy py-16 text-on-navy" aria-labelledby="try-summary">
        <div className="wrap">
          <h2 id="try-summary" className="text-[clamp(26px,2.6vw,38px)] text-on-navy">
            What happened
          </h2>
          <ol className="mt-8 grid gap-6 p-0 md:grid-cols-2 lg:grid-cols-4">
            <li className="list-none">
              <p className="ui num text-[44px] font-bold leading-none">{applies.length}<span className="text-on-navy-muted"> / {r.clauses.length}</span></p>
              <p className="mt-2 text-[16px]">clauses apply to a {r.entityType}. The Reader segmented {r.ref === "USR-000" ? "the pasted text" : r.ref} and scoped each clause.</p>
            </li>
            <li className="list-none">
              <p className="ui num text-[44px] font-bold leading-none">{r.obligations.length}</p>
              <p className="mt-2 text-[16px]">
                {plural(r.obligations.length, "obligation")} extracted by the {r.path === "llm" ? "Claude" : "rule-based"} extractor, {quantitative.length} quantitative. Each span is an exact substring of its clause.
              </p>
            </li>
            <li className="list-none">
              <p className="ui num text-[44px] font-bold leading-none">{r.rejected.length}</p>
              <p className="mt-2 text-[16px]">{plural(r.rejected.length, "proposal")} rejected by verification. Rejected items are never repaired or used.</p>
            </li>
            <li className="list-none">
              <p className="ui num text-[44px] font-bold leading-none">{r.rules.length}</p>
              <p className="mt-2 text-[16px]">
                draft {r.rules.length === 1 ? "rule" : "rules"} compiled; {allTests.length - failed.length} of {allTests.length} boundary tests pass{failed.length ? `, ${failed.length} fail` : ""}. None is deployed.
              </p>
            </li>
          </ol>
          {r.notes.length > 0 && (
            <ul className="ui mt-10 max-w-[90ch] space-y-2 p-0 text-[14.5px] text-on-navy-muted">
              {r.notes.map((n) => (
                <li key={n} className="list-none">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="wrap py-16" aria-labelledby="try-clauses">
        <H2 id="try-clauses">Clauses and applicability</H2>
        <p className="mt-4 max-w-[64ch] text-[17px] text-muted">
          A clause applies when its scope includes your entity type and it carries an obligation verb (shall, shall not, must). Definitions, commencement and repeal paragraphs are informational. Highlighted text is the exact span each obligation was taken from.
        </p>
        <ul className="mt-8 space-y-2 p-0">
          {r.clauses.map((c) => {
            const a = APPLICABILITY[c.applicability];
            const spans = r.obligations.filter((o) => o.clauseId === c.id).map((o) => ({ start: o.spanStart, end: o.spanEnd }));
            return (
              <li key={c.id} className={`list-none p-4 ${c.applicability === "applies" ? "bg-surface" : "bg-bg outline outline-1 -outline-offset-1 outline-surface-2"}`}>
                <div className="ui flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="num text-[15px] font-semibold text-ink">{c.number}</span>
                  <span className="text-[15px] font-semibold text-ink">{c.heading}</span>
                  <Tag tone={a.tone}>{a.label}</Tag>
                  <span className="text-[13px] text-muted">{c.reason}</span>
                </div>
                <p className={`mt-2 max-w-[90ch] text-[16px] leading-[1.6] ${c.applicability === "applies" ? "text-ink" : "text-muted"}`}>
                  <Marked text={c.text} spans={spans} />
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-surface py-16" aria-labelledby="try-obligations">
        <div className="wrap">
          <H2 id="try-obligations">Obligations</H2>
          <p className="mt-4 max-w-[64ch] text-[17px] text-muted">
            The operator is the condition under which the bank&apos;s rule must fire, read from the comparator phrase. &quot;Exceeding&quot; and &quot;shall not exceed&quot; are ceilings that fire only strictly above the number; &quot;not less than&quot; is a floor that fires only strictly below it.
          </p>
          {r.obligations.length === 0 ? (
            <p className="ui mt-8 bg-bg px-4 py-6 text-[15px] text-muted">
              No obligations were extracted. The rule-based extractor recognises a percentage limit (&quot;12 per cent of Tier 1 capital&quot;) with a comparator, a Board reporting deadline, or a policy constraint.
            </p>
          ) : (
            <div className="mt-8 space-y-2">
              {r.obligations.map((o) => {
                const clause = clauseById.get(o.clauseId);
                return (
                  <article key={o.id} className="grid gap-4 bg-bg p-5 lg:grid-cols-12" aria-labelledby={`${o.id}-h`}>
                    <div className="lg:col-span-3">
                      <h3 id={`${o.id}-h`} className="ui text-[17px] tracking-[-0.01em]">
                        {o.id}
                      </h3>
                      <p className="ui mt-1 text-[14px] text-muted">
                        Paragraph {o.clauseNumber} · {o.kind} · {o.modality.replace("_", " ")} · by {o.extractedBy}
                      </p>
                      {o.kind === "quantitative" && o.operator && (
                        <p className="ui mt-3 text-[15px] text-ink">
                          {o.metricLabel ?? <span className="text-bad">metric not in semantic model</span>}{" "}
                          <span className="code font-semibold">{o.operator}</span> <span className="num font-semibold">{o.threshold}%</span>
                        </p>
                      )}
                      {o.kind === "procedural" && <p className="ui mt-3 text-[15px] text-ink">{o.action.replaceAll("_", " ")}</p>}
                    </div>
                    <div className="lg:col-span-5">
                      <p className="text-[16px] leading-[1.6] text-ink">
                        {clause ? <Marked text={clause.text} spans={[{ start: o.spanStart, end: o.spanEnd }]} /> : <mark className="bg-accent-soft text-ink">{o.span}</mark>}
                      </p>
                      <p className="ui num mt-2 text-[12.5px] text-muted">
                        Span characters {o.spanStart} to {o.spanEnd} of the clause, verified as an exact substring.
                      </p>
                    </div>
                    <div className="ui text-[14.5px] leading-relaxed lg:col-span-4">
                      {o.operatorWhy && <p className="text-ink">{o.operatorWhy}</p>}
                      {o.ruleId ? (
                        <p className="mt-2 text-ok">
                          Drafted as <a href={`#${o.ruleId}`} className="link font-semibold">{o.ruleId}</a>.
                        </p>
                      ) : (
                        o.noRuleReason && <p className="mt-2 text-muted">No rule drafted. {o.noRuleReason}</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <h3 className="mt-14 text-[22px]">Rejected</h3>
          {r.rejected.length === 0 ? (
            <p className="ui mt-3 text-[15px] text-muted">
              Nothing was rejected. {r.path === "rule-based" ? "The rule-based extractor copies spans from the clause, so they verify by construction; the check still runs." : "Every span Claude proposed matched its clause exactly."}
            </p>
          ) : (
            <ul className="mt-4 space-y-2 p-0">
              {r.rejected.map((x, i) => (
                <li key={i} className="ui list-none bg-bad-soft px-4 py-3 text-[15px]">
                  <span className="font-semibold text-bad">Paragraph {x.clauseNumber}: {x.reason}.</span>{" "}
                  <span className="text-ink">Proposed span: &quot;{x.span}&quot;</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="wrap py-16" aria-labelledby="try-rules">
        <H2 id="try-rules">Draft rules and boundary tests</H2>
        <p className="mt-4 max-w-[64ch] text-[17px] text-muted">
          Each quantitative obligation with a known metric becomes a typed YAML rule, compiled to SQL and run against generated fixtures. The tests are generated from the obligation, not the draft, so a draft that misread the clause would fail them. These drafts are not approved, committed or deployed.
        </p>
        {r.rules.length === 0 ? (
          <p className="ui mt-8 bg-surface px-4 py-6 text-[15px] text-muted">
            No rule could be drafted. A rule needs a quantitative obligation on a metric the bank&apos;s semantic model defines: single counterparty exposure, group exposure, or the top-20 borrower share.
          </p>
        ) : (
          <div className="mt-8 space-y-10">
            {r.rules.map((rule) => {
              const pass = rule.tests.filter((t) => t.pass).length;
              return (
                <article key={rule.ruleId} id={rule.ruleId} className="scroll-mt-20 grid gap-6 lg:grid-cols-12" aria-labelledby={`${rule.ruleId}-h`}>
                  <div className="lg:col-span-5">
                    <h3 id={`${rule.ruleId}-h`} className="ui text-[19px] tracking-[-0.01em]">
                      {rule.ruleId}, from paragraph {rule.clauseNumber}
                    </h3>
                    <pre className="mt-3 overflow-x-auto bg-navy p-4 text-on-navy">{rule.yaml}</pre>
                  </div>
                  <div className="lg:col-span-7">
                    <p className="ui text-[15px] text-ink">
                      <span className={pass === rule.tests.length ? "font-semibold text-ok" : "font-semibold text-bad"}>
                        {pass} of {rule.tests.length} tests pass
                      </span>{" "}
                      <span className="text-muted">for obligation {rule.obligationId}.</span>
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="ui w-full min-w-[540px] border-collapse text-[14px]">
                        <caption className="sr-only">Boundary tests for {rule.ruleId}</caption>
                        <thead>
                          <tr className="text-left text-muted">
                            <th scope="col" className="px-3 py-2 font-normal">Test</th>
                            <th scope="col" className="px-3 py-2 font-normal">Given</th>
                            <th scope="col" className="px-3 py-2 font-normal">Expected</th>
                            <th scope="col" className="px-3 py-2 font-normal">Rule did</th>
                            <th scope="col" className="px-3 py-2 font-normal">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rule.tests.map((t) => (
                            <tr key={t.id} className="align-top odd:bg-surface">
                              <td className="px-3 py-2 font-semibold text-ink">{t.name}</td>
                              <td className="num px-3 py-2 text-ink">{t.given}</td>
                              <td className="px-3 py-2 text-ink">{t.expectFire ? "Alert" : "No alert"}</td>
                              <td className="px-3 py-2 text-ink">{t.fired ? "Alert" : "No alert"}</td>
                              <td className="px-3 py-2">
                                <Tag tone={t.pass ? "ok" : "bad"}>{t.pass ? "Pass" : "Fail"}</Tag>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="ui mt-12 max-w-[78ch] bg-surface px-4 py-3 text-[14px] text-muted">
          Analysis only. In the full pipeline these drafts would still go through mapping against the live rulebook, a backtest on the loan book, two signatures, shadow mode and a canary before going live.
        </p>
      </section>
    </div>
  );
}
