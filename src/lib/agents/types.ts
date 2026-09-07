import type { LaunchableAgentId, TuiAgent } from "./catalog";

export type AgentStatus = "starting" | "running" | "exited" | "error";

export type AgentViewMode = "chat" | "terminal";

export type ChatRole = "user" | "assistant" | "system";

export type ThinkingLevel = "off" | "low" | "medium" | "high" | "xhigh" | "max";

export type AccessMode = "full" | "workspace" | "read";

export function isAgentViewMode(value: unknown): value is AgentViewMode {
  return value === "chat" || value === "terminal";
}

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return (
    value === "off" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  );
}

export function isAccessMode(value: unknown): value is AccessMode {
  return value === "full" || value === "workspace" || value === "read";
}

export interface ChatAttachment {
  id: string;
  kind: "image" | "file";
  name: string;
  mime: string;
  size: number;
  relPath: string;
  preview?: string;
}

/** A note or skill the user pointed at with `@`; the file itself is not copied. */
export interface ChatReference {
  id: string;
  kind: "file" | "skill";
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  pending?: boolean;
  attachments?: ChatAttachment[];
  references?: ChatReference[];
  /** The agent's reasoning, kept out of the answer and collapsed by default. */
  thinking?: string;
  thinkingDuration?: string;
}

export interface AgentSession {
  id: string;
  name: string;
  agentId: LaunchableAgentId;
  launchCommand: string;
  createdAt: number;
  status: AgentStatus;
  exitCode: number | null;
  error: string | null;
  viewMode: AgentViewMode;
  messages: ChatMessage[];
  modelId?: string;
  thinking?: ThinkingLevel;
  accessMode?: AccessMode;
  /** Context window usage as reported by the agent's own status line. */
  context?: { used: number; limit: number };
}

export type AgentMissingReason = "not-on-path" | "missing-required" | "unsupported-runtime";

export interface HostAgentProbe {
  id: TuiAgent;
  name: string;
  launchCommand: string;
  detectCmd: string;
  detectCommands: string[];
  requiredCommands: string[];
  available: boolean;
  resolvedPath: string | null;
  resolvedCmd: string | null;
  missingReason: AgentMissingReason | null;
  missingDetail: string | null;
  yolo: boolean;
}
