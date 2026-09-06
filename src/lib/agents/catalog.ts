export type TuiAgent =
  | "claude"
  | "openclaude"
  | "codex"
  | "autohand"
  | "opencode"
  | "mimo-code"
  | "minimax-code"
  | "pi"
  | "omp"
  | "prime-agent"
  | "gemini"
  | "antigravity"
  | "aider"
  | "goose"
  | "amp"
  | "kilo"
  | "kiro"
  | "crush"
  | "aug"
  | "cline"
  | "codebuff"
  | "command-code"
  | "continue"
  | "cursor"
  | "droid"
  | "kimi"
  | "mistral-vibe"
  | "qwen-code"
  | "rovo"
  | "hermes"
  | "openclaw"
  | "copilot"
  | "grok"
  | "devin"
  | "ante"
  | "trae";

/** Built-in TUI agents plus a freeform CLI. */
export type LaunchableAgentId = TuiAgent | "custom" | "terminal";

export type AgentPermissionMode = "yolo" | "manual";

export type TuiAgentDetectionRuntime = NodeJS.Platform | "wsl";

export type PromptInjectionMode =
  | "argv"
  | "flag-prompt"
  | "flag-prompt-interactive"
  | "flag-interactive"
  | "stdin-after-start"
  | "hermes-query";

export interface TuiAgentSpec {
  id: LaunchableAgentId;
  name: string;
  detectCmd: string;
  detectCmdAliases?: readonly string[];
  detectRequiredCommands?: readonly string[];
  detectUnsupportedRuntimes?: readonly TuiAgentDetectionRuntime[];
  launchCmd: string;
  yoloArgs: string;
  yoloEnv?: Record<string, string>;
  promptInjectionMode: PromptInjectionMode;
  argvPromptSeparator?: "--";
}

/**
 * Built-in agent launch catalog. Yolo mode appends permission-bypass args.
 */
export const TUI_AGENTS: TuiAgentSpec[] = [
  {
    id: "claude",
    name: "Claude",
    detectCmd: "claude",
    launchCmd: "claude",
    yoloArgs: "--dangerously-skip-permissions",
    promptInjectionMode: "argv",
  },
  {
    id: "openclaude",
    name: "OpenClaude",
    detectCmd: "openclaude",
    launchCmd: "openclaude",
    yoloArgs: "--dangerously-skip-permissions",
    promptInjectionMode: "argv",
  },
  {
    id: "codex",
    name: "Codex",
    detectCmd: "codex",
    launchCmd: "codex",
    yoloArgs: "--dangerously-bypass-approvals-and-sandbox",
    promptInjectionMode: "argv",
  },
  {
    id: "grok",
    name: "Grok",
    detectCmd: "grok",
    launchCmd: "grok",
    yoloArgs: "--permission-mode bypassPermissions",
    promptInjectionMode: "argv",
    argvPromptSeparator: "--",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    detectCmd: "copilot",
    launchCmd: "copilot",
    yoloArgs: "--yolo",
    promptInjectionMode: "flag-interactive",
  },
  {
    id: "opencode",
    name: "OpenCode",
    detectCmd: "opencode",
    launchCmd: "opencode",
    yoloArgs: "",
    promptInjectionMode: "flag-prompt",
  },
  {
    id: "mimo-code",
    name: "MiMo Code",
    detectCmd: "mimo",
    launchCmd: "mimo",
    yoloArgs: "",
    promptInjectionMode: "flag-prompt",
  },
  {
    id: "minimax-code",
    name: "MiniMax Code",
    detectCmd: "mcode",
    detectCmdAliases: ["minimax-code"],
    launchCmd: "mcode",
    yoloArgs: "",
    promptInjectionMode: "argv",
    argvPromptSeparator: "--",
  },
  {
    id: "autohand",
    name: "Autohand Code",
    detectCmd: "autohand",
    launchCmd: "autohand",
    yoloArgs: "--unrestricted",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "pi",
    name: "Pi",
    detectCmd: "pi",
    launchCmd: "pi",
    yoloArgs: "",
    promptInjectionMode: "argv",
  },
  {
    id: "omp",
    name: "OMP",
    detectCmd: "omp",
    launchCmd: "omp",
    yoloArgs: "",
    promptInjectionMode: "argv",
  },
  {
    id: "prime-agent",
    name: "Prime Agent",
    detectCmd: "prime-agent",
    launchCmd: "prime-agent",
    yoloArgs: "",
    promptInjectionMode: "argv",
    argvPromptSeparator: "--",
  },
  {
    id: "gemini",
    name: "Gemini",
    detectCmd: "gemini",
    launchCmd: "gemini",
    yoloArgs: "--yolo",
    promptInjectionMode: "flag-prompt-interactive",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    detectCmd: "agy",
    launchCmd: "agy",
    yoloArgs: "--dangerously-skip-permissions",
    promptInjectionMode: "flag-prompt-interactive",
  },
  {
    id: "aider",
    name: "Aider",
    detectCmd: "aider",
    launchCmd: "aider",
    yoloArgs: "--yes-always",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "goose",
    name: "Goose",
    detectCmd: "goose",
    launchCmd: "goose",
    yoloArgs: "",
    yoloEnv: { GOOSE_MODE: "auto" },
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "amp",
    name: "Amp",
    detectCmd: "amp",
    launchCmd: "amp",
    yoloArgs: "--dangerously-allow-all",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "kilo",
    name: "Kilocode",
    detectCmd: "kilo",
    launchCmd: "kilo",
    yoloArgs: "",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "kiro",
    name: "Kiro",
    detectCmd: "kiro-cli",
    launchCmd: "kiro-cli chat --tui",
    yoloArgs: "--trust-all-tools",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "crush",
    name: "Charm",
    detectCmd: "crush",
    launchCmd: "crush",
    yoloArgs: "--yolo",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "aug",
    name: "Auggie",
    detectCmd: "auggie",
    launchCmd: "auggie",
    yoloArgs: "",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "cline",
    name: "Cline",
    detectCmd: "cline",
    launchCmd: "cline",
    yoloArgs: "--auto-approve true",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "codebuff",
    name: "Codebuff",
    detectCmd: "codebuff",
    launchCmd: "codebuff",
    yoloArgs: "",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "command-code",
    name: "Command Code",
    detectCmd: "command-code",
    launchCmd: "command-code --trust",
    yoloArgs: "--yolo",
    promptInjectionMode: "argv",
  },
  {
    id: "continue",
    name: "Continue",
    detectCmd: "cn",
    launchCmd: "cn",
    yoloArgs: '--allow "*"',
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "cursor",
    name: "Cursor",
    detectCmd: "cursor-agent",
    launchCmd: "cursor-agent",
    yoloArgs: "--yolo",
    promptInjectionMode: "argv",
  },
  {
    id: "droid",
    name: "Droid",
    detectCmd: "droid",
    launchCmd: "droid",
    yoloArgs: "--auto high",
    promptInjectionMode: "argv",
  },
  {
    id: "kimi",
    name: "Kimi",
    detectCmd: "kimi",
    launchCmd: "kimi",
    yoloArgs: "--yolo",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "mistral-vibe",
    name: "Mistral Vibe",
    detectCmd: "vibe",
    detectCmdAliases: ["mistral-vibe"],
    launchCmd: "vibe",
    yoloArgs: "--agent auto-approve",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "qwen-code",
    name: "Qwen Code",
    detectCmd: "qwen",
    launchCmd: "qwen",
    yoloArgs: "--approval-mode yolo",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "rovo",
    name: "Rovo Dev",
    detectCmd: "rovo",
    launchCmd: "rovo",
    yoloArgs: "--yolo",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "hermes",
    name: "Hermes",
    detectCmd: "hermes",
    launchCmd: "hermes --tui",
    yoloArgs: "--yolo",
    promptInjectionMode: "hermes-query",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    detectCmd: "openclaw",
    launchCmd: "openclaw",
    yoloArgs: "",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "devin",
    name: "Devin",
    detectCmd: "devin",
    launchCmd: "devin",
    yoloArgs: "--permission-mode bypass",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "ante",
    name: "Ante",
    detectCmd: "ante",
    launchCmd: "ante",
    yoloArgs: "--yolo",
    promptInjectionMode: "stdin-after-start",
  },
  {
    id: "trae",
    name: "Trae",
    detectCmd: "traecli",
    launchCmd: "traecli",
    yoloArgs: "--yolo",
    promptInjectionMode: "argv",
    argvPromptSeparator: "--",
  },
];

export const TUI_AGENT_BY_ID: Record<TuiAgent, TuiAgentSpec> = Object.fromEntries(
  TUI_AGENTS.map((spec) => [spec.id, spec]),
) as Record<TuiAgent, TuiAgentSpec>;

export const TUI_AGENT_AUTO_PICK_ORDER = [
  "claude",
  "openclaude",
  "codex",
  "grok",
  "copilot",
  "opencode",
  "mimo-code",
  "minimax-code",
  "ante",
  "trae",
  "pi",
  "omp",
  "prime-agent",
  "gemini",
  "antigravity",
  "aider",
  "goose",
  "amp",
  "kilo",
  "kiro",
  "crush",
  "aug",
  "autohand",
  "cline",
  "codebuff",
  "command-code",
  "continue",
  "cursor",
  "droid",
  "kimi",
  "mistral-vibe",
  "qwen-code",
  "rovo",
  "hermes",
  "devin",
  "openclaw",
] as const satisfies readonly TuiAgent[];

export type DefaultAgentId = TuiAgent | "auto" | "blank";

export function pickTuiAgent(
  preferred: DefaultAgentId | null | undefined,
  detected: Iterable<TuiAgent>,
  disabled: Iterable<TuiAgent> = [],
): TuiAgent | null {
  const detectedSet = new Set(detected);
  const disabledSet = new Set(disabled);
  if (preferred && preferred !== "auto" && preferred !== "blank") {
    if (detectedSet.has(preferred) && !disabledSet.has(preferred)) return preferred;
  }
  if (preferred === "blank") return null;
  for (const agent of TUI_AGENT_AUTO_PICK_ORDER) {
    if (detectedSet.has(agent) && !disabledSet.has(agent)) return agent;
  }
  return null;
}

export function filterEnabledTuiAgents(
  detected: Iterable<TuiAgent>,
  disabled: Iterable<TuiAgent> = [],
): TuiAgent[] {
  const disabledSet = new Set(disabled);
  return [...detected].filter((id) => !disabledSet.has(id));
}

export function orderTuiAgents(
  agents: Iterable<TuiAgent>,
  defaultAgent: DefaultAgentId | null | undefined,
): TuiAgent[] {
  const set = new Set(agents);
  const ordered = TUI_AGENT_AUTO_PICK_ORDER.filter((id) => set.has(id));
  if (!defaultAgent || defaultAgent === "auto" || defaultAgent === "blank") return ordered;
  if (!ordered.includes(defaultAgent)) return ordered;
  return [defaultAgent, ...ordered.filter((id) => id !== defaultAgent)];
}

export function getTuiAgentDetectCommands(config: Pick<TuiAgentSpec, "detectCmd" | "detectCmdAliases">): string[] {
  return [config.detectCmd, ...(config.detectCmdAliases ?? [])];
}

export function isTuiAgent(value: unknown): value is TuiAgent {
  return typeof value === "string" && Object.hasOwn(TUI_AGENT_BY_ID, value);
}

export function isAgentPermissionMode(value: unknown): value is AgentPermissionMode {
  return value === "yolo" || value === "manual";
}

export function customLaunchSpec(command: string, name = "Custom CLI"): TuiAgentSpec | null {
  const launchCmd = command.trim();
  if (!launchCmd) return null;
  const detectCmd = launchCmd.split(/\s+/)[0] ?? launchCmd;
  return {
    id: "custom",
    name: name.trim() || "Custom CLI",
    detectCmd,
    launchCmd,
    yoloArgs: "",
    promptInjectionMode: "stdin-after-start",
  };
}

export function terminalLaunchSpec(command = "$SHELL"): TuiAgentSpec {
  return {
    id: "terminal",
    name: "终端",
    detectCmd: "bash",
    launchCmd: command,
    yoloArgs: "",
    promptInjectionMode: "stdin-after-start",
  };
}

export function resolveLaunchSpec(
  agentId: LaunchableAgentId,
  customCommand = "",
): TuiAgentSpec | null {
  if (agentId === "terminal") return terminalLaunchSpec();
  if (agentId === "custom") return customLaunchSpec(customCommand);
  return TUI_AGENT_BY_ID[agentId] ?? null;
}

/** Quote a startup arg for posix shells (sh/bash/zsh/fish). */
export function quoteStartupArg(value: string): string {
  if (!value) return "''";
  const parts: string[] = [];
  let literal = "";
  const flush = () => {
    if (literal) {
      parts.push(`'${literal}'`);
      literal = "";
    }
  };
  for (const char of value) {
    if (char === "'") {
      flush();
      parts.push(`"'"`);
    } else if (char === "\\") {
      flush();
      parts.push('"\\\\"');
    } else {
      literal += char;
    }
  }
  flush();
  return parts.join("");
}

function tokenizeArgs(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function yoloArgsSuffix(yoloArgs: string): string {
  const trimmed = yoloArgs.trim();
  if (!trimmed) return "";
  return tokenizeArgs(trimmed).map(quoteStartupArg).join(" ");
}

export function buildLaunchCommand(
  spec: TuiAgentSpec,
  prompt = "",
  permissionMode: AgentPermissionMode = "yolo",
): { command: string; env: Record<string, string> } {
  const yolo = permissionMode !== "manual";
  const suffix = yolo ? yoloArgsSuffix(spec.yoloArgs) : "";
  const base = suffix ? `${spec.launchCmd} ${suffix}` : spec.launchCmd;
  const env = yolo ? { ...(spec.yoloEnv ?? {}) } : {};
  const trimmed = prompt.trim();
  if (!trimmed) return { command: base, env };

  const quoted = quoteStartupArg(trimmed);
  switch (spec.promptInjectionMode) {
    case "argv": {
      const sep = spec.argvPromptSeparator ? ` ${spec.argvPromptSeparator}` : "";
      return { command: `${base}${sep} ${quoted}`, env };
    }
    case "flag-prompt":
      return { command: `${base} --prompt ${quoted}`, env };
    case "flag-prompt-interactive":
      return { command: `${base} --prompt-interactive ${quoted}`, env };
    case "flag-interactive":
      return { command: `${base} -i ${quoted}`, env };
    default:
      return { command: base, env };
  }
}

export function sessionTitle(agentId: LaunchableAgentId): string {
  if (agentId === "terminal") return "终端";
  if (agentId === "custom") return "CLI";
  return TUI_AGENT_BY_ID[agentId]?.name ?? agentId;
}

export function nextSessionName(agentId: LaunchableAgentId, existing: string[]): string {
  const base = sessionTitle(agentId);
  const used = new Set(existing);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function formatLaunchDisplay(
  spec: TuiAgentSpec,
  prompt = "",
  permissionMode: AgentPermissionMode = "yolo",
): string {
  const { command, env } = buildLaunchCommand(spec, prompt, permissionMode);
  const prefix = Object.entries(env)
    .map(([key, value]) => `${key}=${quoteStartupArg(value)}`)
    .join(" ");
  return prefix ? `${prefix} ${command}` : command;
}

/** Unquoted command line for settings rows. */
export function formatLaunchLine(
  spec: TuiAgentSpec,
  permissionMode: AgentPermissionMode = "yolo",
): string {
  const yolo = permissionMode !== "manual";
  const args = yolo ? spec.yoloArgs.trim() : "";
  const env = yolo ? (spec.yoloEnv ?? {}) : {};
  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  const command = args ? `${spec.launchCmd} ${args}` : spec.launchCmd;
  return envPrefix ? `${envPrefix} ${command}` : command;
}
