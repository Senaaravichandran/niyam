import { z } from "zod";
import YAML from "yaml";
import { METRICS } from "../data/semanticModel";

/**
 * NIYAM Rule DSL. A rule is data, never code: the LLM (or the rule-based author) can only fill
 * these typed fields, and a deterministic compiler turns them into SQL.
 */

export const OPERATORS = [">", ">=", "<", "<=", "=="] as const;
export type Operator = (typeof OPERATORS)[number];

export const ACTIONS = ["flag_for_report", "block_new_exposure", "raise_alert"] as const;

const metricIds = METRICS.map((m) => m.id) as [string, ...string[]];

export const RuleSchema = z
  .object({
    rule_id: z.string().regex(/^SYN-[A-Z]{3}-\d{3}$/, "rule_id must look like SYN-ABC-123"),
    version: z.number().int().positive(),
    status: z.enum(["draft", "approved", "live", "retired"]),
    title: z.string().min(4),
    applies_to: z.array(z.enum(["UCB", "NBFC-ML", "NBFC-UL", "SCB"])).min(1),
    when: z.object({
      metric: z.enum(metricIds),
      op: z.enum(OPERATORS),
      value: z.number().finite(),
      unit: z.literal("pct"),
    }),
    unless: z.enum(["board_approved"]).optional(),
    action: z.enum(ACTIONS),
    severity: z.enum(["low", "medium", "high"]),
    source: z.object({
      circular: z.string(),
      clause: z.string(),
      obligation: z.string().optional(),
      span: z.string().min(8),
    }),
  })
  .strict();

export type Rule = z.infer<typeof RuleSchema>;

const KEY_ORDER = [
  "rule_id",
  "version",
  "status",
  "title",
  "applies_to",
  "when",
  "unless",
  "action",
  "severity",
  "source",
];

/** Serialise with a stable key order so git diffs and approval hashes are reproducible. */
export function toYaml(rule: Rule): string {
  const ordered: Record<string, unknown> = {};
  for (const k of KEY_ORDER) {
    const v = (rule as Record<string, unknown>)[k];
    if (v !== undefined) ordered[k] = v;
  }
  const doc = new YAML.Document(ordered);
  YAML.visit(doc, {
    Pair(_, pair) {
      const key = (pair.key as YAML.Scalar | null)?.value;
      if (key === "op" && YAML.isScalar(pair.value)) {
        pair.value.type = YAML.Scalar.QUOTE_DOUBLE;
      }
      if (key === "applies_to" && YAML.isSeq(pair.value)) pair.value.flow = true;
    },
  });
  return doc.toString({ lineWidth: 0 });
}

export class RuleParseError extends Error {
  constructor(public issues: string[]) {
    super(`Rule is invalid: ${issues.join("; ")}`);
  }
}

export function parseRule(yamlText: string): Rule {
  let raw: unknown;
  try {
    raw = YAML.parse(yamlText);
  } catch (e) {
    throw new RuleParseError([`YAML syntax: ${(e as Error).message}`]);
  }
  const res = RuleSchema.safeParse(raw);
  if (!res.success) {
    throw new RuleParseError(
      res.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    );
  }
  return res.data;
}
