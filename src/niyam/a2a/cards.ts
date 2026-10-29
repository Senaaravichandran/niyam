import { ALLOWLIST } from "../mcp/allowlist";
import { A2A_PROTOCOL_VERSION, type AgentCard, type AgentSkill } from "./types";

export type AgentId = "conductor" | "reader" | "extractor" | "mapper" | "author" | "validator" | "release";

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  summary: string;
  model: string;
  skills: AgentSkill[];
}

export const AGENTS: AgentDef[] = [
  {
    id: "conductor",
    name: "Conductor",
    role: "Orchestrator",
    summary: "Plans the run, discovers workers by the skills on their Agent Cards, delegates A2A tasks, enforces iteration budgets and stops at the human gate.",
    model: "No LLM: deterministic planner",
    skills: [
      {
        id: "orchestrate-circular",
        name: "Circular to rule run",
        description: "Run a circular through reading, extraction, mapping, authoring and validation, then hand an approval pack to humans.",
        tags: ["orchestration", "planning", "regulation"],
        examples: ["Process circular RBI-SYN-2026-017 for BANK-SYN-UCB-07"],
      },
    ],
  },
  {
    id: "reader",
    name: "Reader",
    role: "Circular intake and applicability",
    summary: "Splits the circular into numbered clauses and tags each one against the bank profile: applies, not applicable, or informational.",
    model: "Rule-based segmenter and scope matcher",
    skills: [
      {
        id: "segment-and-scope",
        name: "Segment and scope a circular",
        description: "Split circular text into clauses with stable numbers such as 4(b), and decide applicability for an entity type.",
        tags: ["regulation", "segmentation", "applicability"],
        examples: ["Segment RBI-SYN-2026-017 and scope it for a UCB"],
      },
    ],
  },
  {
    id: "extractor",
    name: "Extractor",
    role: "Obligation extraction",
    summary: "Turns each applicable clause into a typed obligation with metric, operator, threshold, unit and effective date. Every obligation carries a span that must be an exact substring of its clause.",
    model: "Claude when a key is configured, otherwise rule-based patterns",
    skills: [
      {
        id: "extract-obligations",
        name: "Extract obligations",
        description: "Clause text to {modality, metric, operator, threshold, unit, scope, effective date, exact source span}.",
        tags: ["obligation", "deontic", "extraction", "provenance"],
        examples: ['Extract obligations from: "...exposure exceeding 12 per cent of Tier 1 capital."'],
      },
    ],
  },
  {
    id: "mapper",
    name: "Mapper",
    role: "Policy and rule mapping",
    summary: "Links obligations to the bank's policies and live rules in the knowledge graph and classifies each: modify, gap, conflict or manual control.",
    model: "Knowledge-graph queries, no LLM",
    skills: [
      {
        id: "map-obligations",
        name: "Map obligations to rules and policies",
        description: "Find rules to modify, gaps where no rule exists, and policy sections that conflict with the circular.",
        tags: ["knowledge-graph", "mapping", "conflict-detection"],
      },
    ],
  },
  {
    id: "author",
    name: "Author",
    role: "Rule drafting",
    summary: "Writes typed DSL drafts on a git draft branch, one commit per rule, and revises them when the Validator objects.",
    model: "Claude when a key is configured, otherwise minimal-diff templating",
    skills: [
      {
        id: "draft-rule",
        name: "Draft rule change",
        description: "Produce a typed YAML rule draft for an obligation, committed to draft/<circular>.",
        tags: ["rule-dsl", "authoring", "git"],
      },
      {
        id: "resolve-objection",
        name: "Resolve objection",
        description: "Revise a draft in response to a Validator objection and resubmit.",
        tags: ["objection", "revision"],
      },
    ],
  },
  {
    id: "validator",
    name: "Validator",
    role: "Independent challenge and backtest",
    summary: "Checks every draft against its obligation: schema, operator fidelity, threshold, unit, scope and the generated tests. Raises A2A objections to the Author. Then backtests old against new on 90 days of data.",
    model: "Deterministic checks, no LLM, by design independent of the Author",
    skills: [
      {
        id: "validate-draft",
        name: "Validate rule draft",
        description: "Compare a draft with its obligation and run boundary tests derived from the clause.",
        tags: ["validation", "boundary-tests", "objection"],
      },
      {
        id: "backtest-impact",
        name: "Backtest and impact",
        description: "Replay the synthetic loan book through old and new rules and report alert deltas and workload.",
        tags: ["backtest", "impact", "sandbox"],
      },
    ],
  },
  {
    id: "release",
    name: "Release",
    role: "Approval and rollout",
    summary: "Verifies two-person approval tokens, rolls out shadow, canary and live behind feature flags, polls the Sentinel drift monitor and rolls back automatically.",
    model: "Deterministic, no LLM",
    skills: [
      {
        id: "release-rule",
        name: "Release approved rule",
        description: "Verify approvals, run shadow, canary 10% and live, watch drift, roll back on breach.",
        tags: ["deployment", "feature-flags", "rollback", "monitoring"],
      },
    ],
  },
];

export function agentDef(id: string) {
  return AGENTS.find((a) => a.id === id);
}

export function buildCard(id: AgentId, baseUrl: string): AgentCard {
  const a = agentDef(id)!;
  return {
    name: `niyam-${a.id}`,
    description: `${a.name}: ${a.summary}`,
    supportedInterfaces: [
      { url: `${baseUrl}/a2a/${a.id}`, protocolBinding: "JSONRPC", protocolVersion: A2A_PROTOCOL_VERSION },
    ],
    provider: { organization: "Team Dragorithm (NIYAM)", url: baseUrl },
    version: "1.0.0",
    documentationUrl: `${baseUrl}/architecture#${a.id}`,
    iconUrl: `${baseUrl}/icon.svg`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
      extensions: [
        {
          uri: `${baseUrl}/ext/mcp-allowlist/v1`,
          description: "MCP tools this agent may call. Enforced by the agent's client and by every MCP server.",
          required: true,
          params: { tools: ALLOWLIST[a.id] },
        },
      ],
    },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json"],
    skills: a.skills.map((s) => ({ ...s, inputModes: ["application/json", "text/plain"], outputModes: ["application/json"] })),
  };
}
