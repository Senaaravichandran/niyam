/**
 * Regulatory Knowledge Graph.
 * In-memory property graph with the same node labels and relationship types as the Neo4j schema.
 * The Neo4j production design uses the same labels; the Golden Thread Cypher below is what it runs.
 *
 * Chain: Circular -> Clause -> Obligation -> Policy -> Rule -> RuleVersion -> Approval -> Deployment -> Alert
 */

export type NodeLabel =
  | "Regulator"
  | "Circular"
  | "Clause"
  | "Obligation"
  | "Policy"
  | "Rule"
  | "RuleVersion"
  | "BacktestRun"
  | "Approval"
  | "Deployment"
  | "Alert"
  | "Metric";

export type RelType =
  | "ISSUED"
  | "AMENDS"
  | "CONTAINS"
  | "DERIVED_FROM"
  | "MAPPED_TO"
  | "IMPLEMENTED_BY"
  | "CONFLICTS_WITH"
  | "HAS_VERSION"
  | "IMPLEMENTS"
  | "TESTED_BY"
  | "APPROVED"
  | "DEPLOYED_AS"
  | "ROLLED_BACK_TO"
  | "FIRED_BY"
  | "MEASURES";

export interface GraphNode {
  id: string;
  label: NodeLabel;
  props: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: RelType;
  props?: Record<string, unknown>;
}

export class KnowledgeGraph {
  nodes = new Map<string, GraphNode>();
  edges: GraphEdge[] = [];

  upsert(id: string, label: NodeLabel, props: Record<string, unknown> = {}): GraphNode {
    const existing = this.nodes.get(id);
    if (existing) {
      existing.props = { ...existing.props, ...props };
      return existing;
    }
    const node = { id, label, props };
    this.nodes.set(id, node);
    return node;
  }

  link(from: string, type: RelType, to: string, props?: Record<string, unknown>) {
    if (!this.nodes.has(from)) throw new Error(`KG: missing node ${from}`);
    if (!this.nodes.has(to)) throw new Error(`KG: missing node ${to}`);
    if (!this.edges.some((e) => e.from === from && e.to === to && e.type === type)) {
      this.edges.push({ from, to, type, props });
    }
  }

  get(id: string) {
    return this.nodes.get(id);
  }

  out(id: string, type?: RelType): GraphNode[] {
    return this.edges
      .filter((e) => e.from === id && (!type || e.type === type))
      .map((e) => this.nodes.get(e.to)!)
      .filter(Boolean);
  }

  in(id: string, type?: RelType): GraphNode[] {
    return this.edges
      .filter((e) => e.to === id && (!type || e.type === type))
      .map((e) => this.nodes.get(e.from)!)
      .filter(Boolean);
  }

  byLabel(label: NodeLabel): GraphNode[] {
    return [...this.nodes.values()].filter((n) => n.label === label);
  }

  stats() {
    const labels: Record<string, number> = {};
    for (const n of this.nodes.values()) labels[n.label] = (labels[n.label] ?? 0) + 1;
    return { nodes: this.nodes.size, edges: this.edges.length, labels };
  }

  snapshot() {
    return {
      nodes: [...this.nodes.values()],
      edges: this.edges,
    };
  }
}

/** The Cypher the Neo4j adapter runs for a Golden Thread lookup; shown to reviewers. */
export const GOLDEN_THREAD_CYPHER = `MATCH (a:Alert {id: $alertId})-[:FIRED_BY]->(rv:RuleVersion)-[:IMPLEMENTS]->(o:Obligation)
      -[:DERIVED_FROM]->(c:Clause)<-[:CONTAINS]-(circ:Circular)
MATCH (ap:Approval)-[:APPROVED]->(rv)
OPTIONAL MATCH (rv)-[:TESTED_BY]->(bt:BacktestRun)
RETURN a, rv, collect(ap) AS approvals, o, c, circ, bt`;
