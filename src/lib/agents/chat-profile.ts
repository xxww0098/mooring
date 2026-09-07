import type { LaunchableAgentId, PromptInjectionMode } from "./catalog.ts";
import { TUI_AGENT_BY_ID } from "./catalog.ts";

export type ChatSurface = "tui" | "repl";
export type FollowupMode = "paste-cr" | "plain-cr" | "plain-lf";

export interface AgentChatProfile {
  id: LaunchableAgentId;
  surface: ChatSurface;
  followup: FollowupMode;
  clearComposer: boolean;
  submitDelayMs: number;
  submitCount: number;
  readyTimeoutMs: number;
  quietMs: number;
  readyPatterns: readonly string[];
  chromePatterns: readonly string[];
}

const SHARED_READY = [
  "ask grok",
  "ask claude",
  "ask codex",
  "add a follow-up",
  "type a message",
  "send a message",
  "shift\\+tab",
  "bypassing permissions",
  "auto-approve",
  "❯",
  "▶",
];

const SHARED_CHROME = [
  "^ask grok",
  "^ask claude",
  "^ask copilot",
  "^ask codex",
  "^shortcuts?$",
  "^welcome to ",
  "shift\\+tab to cycle",
  "ctrl\\+c to stop",
  "\\? for more",
  "^auto-compaction",
  "^grok code",
  "^claude code",
  "^bypassing permissions",
  "esc to interrupt",
  "^\\d+ files?\\b",
  "^\\d+ lines?\\b",
  "^~/",
  "^enter to send",
  "^type a message",
  "^send a message",
  "^press enter",
  "^to cycle modes",
  "^esc to ",
  "^tab to ",
  "^ctrl\\+",
  "^⌘",
];

const TUI_IDS = new Set<LaunchableAgentId>([
  "claude",
  "openclaude",
  "codex",
  "grok",
  "copilot",
  "opencode",
  "mimo-code",
  "minimax-code",
  "pi",
  "omp",
  "prime-agent",
  "gemini",
  "antigravity",
  "command-code",
  "cursor",
  "droid",
  "trae",
  "hermes",
  "kiro",
  "crush",
]);

function surfaceFor(mode: PromptInjectionMode, id: LaunchableAgentId): ChatSurface {
  if (TUI_IDS.has(id)) return "tui";
  if (mode === "stdin-after-start" || mode === "hermes-query") return "repl";
  return "tui";
}

function followupFor(surface: ChatSurface, mode: PromptInjectionMode): FollowupMode {
  if (surface === "repl") return "plain-lf";
  if (mode === "stdin-after-start") return "plain-lf";
  return "paste-cr";
}

const EXTRA_READY: Partial<Record<LaunchableAgentId, string[]>> = {
  grok: ["ask grok", "grok code"],
  claude: ["try ", "claude code"],
  openclaude: ["try ", "openclaude"],
  codex: ["codex", "/model"],
  copilot: ["copilot"],
  aider: ["aider>", "> "],
  goose: ["(o>", "goose"],
  amp: ["> "],
  cursor: ["cursor", "→ add a follow-up"],
  opencode: ["ask anything"],
  pi: ["ctrl\\+o"],
  antigravity: ["antigravity"],
  hermes: ["^ready\\s"],
};

const EXTRA_CHROME: Partial<Record<LaunchableAgentId, string[]>> = {
  grok: ["week used", "model:", "gpt-", "grok-"],
  claude: ["claude opus", "claude sonnet", "claude haiku", "tokens", "api usage billing", "1m context"],
  codex: ["gpt-5", "codex"],
  opencode: ["^ask anything"],
  pi: ["^\\[skills\\]$", "^\\[extensions\\]$", "ctrl\\+o to show"],
  // The account line ("name@host (Google AI Pro)") sits in the status bar.
  antigravity: ["^\\S+@\\S+\\.\\S+"],
  hermes: ["^system prompt\\b", "^ready\\s"],
};

/**
 * The chat view is a screen scrape of the agent's own TUI. An agent is listed here only
 * after a real turn was driven through it inside Obsidian and the reply rendered, with
 * its prompt (EXTRA_READY) and status-bar chrome (EXTRA_CHROME) profiled from what that
 * run showed. Verified 2026-09-07 on macOS. Every other agent gets the terminal and
 * nothing else.
 */
const CHAT_UI_IDS = new Set<LaunchableAgentId>([
  "claude",
  "openclaude",
  "codex",
  "grok",
  "opencode",
  "pi",
  "antigravity",
  "hermes",
]);

export function supportsChatUi(id: LaunchableAgentId): boolean {
  return CHAT_UI_IDS.has(id);
}

export function getAgentChatProfile(id: LaunchableAgentId): AgentChatProfile {
  const spec = id === "custom" || id === "terminal" ? null : TUI_AGENT_BY_ID[id];
  const mode: PromptInjectionMode = spec?.promptInjectionMode ?? "stdin-after-start";
  const surface = id === "custom" || id === "terminal" ? "repl" : surfaceFor(mode, id);
  return {
    id,
    surface,
    followup: followupFor(surface, mode),
    clearComposer: surface === "tui",
    submitDelayMs: surface === "tui" ? 420 : 40,
    submitCount: surface === "tui" ? 2 : 1,
    readyTimeoutMs: id === "terminal" ? 200 : 5000,
    quietMs: surface === "tui" ? 1800 : 900,
    readyPatterns: [...SHARED_READY, ...(EXTRA_READY[id] ?? [])],
    chromePatterns: [...SHARED_CHROME, ...(EXTRA_CHROME[id] ?? [])],
  };
}

export function lineMatches(patterns: readonly string[], line: string): boolean {
  const value = line.trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, "i").test(value) || new RegExp(pattern, "i").test(lower);
    } catch {
      return lower.includes(pattern.toLowerCase());
    }
  });
}
