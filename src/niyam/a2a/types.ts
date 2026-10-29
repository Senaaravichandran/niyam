/** A2A protocol v1.0 shapes used by NIYAM (JSON-RPC binding). */

export const A2A_PROTOCOL_VERSION = "1.0";

export type Role = "ROLE_USER" | "ROLE_AGENT";

export type TaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_CANCELED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_REJECTED"
  | "TASK_STATE_AUTH_REQUIRED";

export interface Part {
  text?: string;
  data?: unknown;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

export interface Message {
  messageId: string;
  role: Role;
  parts: Part[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface Artifact {
  artifactId: string;
  name: string;
  description?: string;
  parts: Part[];
}

export interface Task {
  id: string;
  contextId: string;
  status: { state: TaskState; timestamp: string; message?: Message };
  artifacts: Artifact[];
  history: Message[];
  metadata?: Record<string, unknown>;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AgentCard {
  name: string;
  description: string;
  supportedInterfaces: { url: string; protocolBinding: "JSONRPC"; protocolVersion: string }[];
  provider: { organization: string; url: string };
  version: string;
  documentationUrl?: string;
  iconUrl?: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    extendedAgentCard: boolean;
    extensions?: { uri: string; description: string; required: boolean; params: Record<string, unknown> }[];
  };
  securitySchemes?: Record<string, unknown>;
  securityRequirements?: Record<string, string[]>[];
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
}

/** v0.3 method names still accepted for interoperability. */
export const METHOD_ALIASES: Record<string, string> = {
  "message/send": "SendMessage",
  "tasks/get": "GetTask",
  "tasks/cancel": "CancelTask",
};

export const RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  taskNotFound: -32001,
  taskNotCancelable: -32002,
  unsupportedOperation: -32004,
} as const;
