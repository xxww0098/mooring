import type { AgentChatProfile, FollowupMode } from "./chat-profile.ts";
import { lineMatches } from "./chat-profile.ts";

export const AGENT_PROMPT_BRACKETED_PASTE_START = "\x1b[200~";
export const AGENT_PROMPT_BRACKETED_PASTE_END = "\x1b[201~";
export const AGENT_PROMPT_SUBMIT_CR = "\r";
export const AGENT_PROMPT_SUBMIT_LF = "\n";
export const AGENT_STOP_BYTES = "\x03";
export const AGENT_CLEAR_LINE = "\x15";

export function sanitizeAgentPromptText(text: string): string {
  return text.replaceAll("\x1b", "");
}

export function buildPasteBytes(prompt: string): string {
  return `${AGENT_PROMPT_BRACKETED_PASTE_START}${sanitizeAgentPromptText(prompt)}${AGENT_PROMPT_BRACKETED_PASTE_END}`;
}

export function buildFollowupBody(prompt: string, mode: FollowupMode): string {
  const body = sanitizeAgentPromptText(prompt);
  if (mode === "paste-cr") return buildPasteBytes(body);
  return body;
}

export function followupSubmit(mode: FollowupMode): string {
  return mode === "plain-lf" ? AGENT_PROMPT_SUBMIT_LF : AGENT_PROMPT_SUBMIT_CR;
}

/** @deprecated use buildFollowupBody + followupSubmit */
export function buildFollowupBytes(prompt: string): string {
  return `${buildFollowupBody(prompt, "plain-cr")}${AGENT_PROMPT_SUBMIT_CR}`;
}

const ANSI_RE = new RegExp(
  [
    String.raw`\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)`,
    String.raw`\x1b[\[\]()#][0-?]*[ -/]*[@-~]`,
    String.raw`\x1b[@-Z\\-_]`,
    String.raw`[\x00-\x08\x0b\x0c\x0e-\x1f]`,
  ].join("|"),
  "g",
);

const BOX_RE = /[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2800-\u28FF]/g;
const SPINNER_RE = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g;

export function stripAnsi(chunk: string): string {
  return chunk.replace(ANSI_RE, "").replaceAll("\r", "");
}

export function cleanTurnText(chunk: string): string {
  return collectChatLines(chunk).join("\n");
}

export function collectChatLines(chunk: string): string[] {
  const lines = stripAnsi(chunk)
    .replace(BOX_RE, "")
    .replace(SPINNER_RE, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "").trim());
  const kept: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^\$ /.test(line)) continue;
    if (/^[>|❯▶➜]{1,2}$/.test(line)) continue;
    if (kept.at(-1) === line) continue;
    kept.push(line);
  }
  return kept;
}

export function isComposerReady(sample: string, profile: AgentChatProfile): boolean {
  const text = stripAnsi(sample);
  return lineMatches(profile.readyPatterns, text) || collectChatLines(sample).some((line) =>
    lineMatches(profile.readyPatterns, line),
  );
}

export function ingestChatLines(
  chunk: string,
  profile: AgentChatProfile,
  seen: Set<string>,
  userText: string,
): string[] {
  const fresh: string[] = [];
  const user = userText.trim();
  for (const line of collectChatLines(chunk)) {
    if (seen.has(line)) continue;
    seen.add(line);
    if (user && (line === user || line.endsWith(user))) continue;
    if (lineMatches(profile.chromePatterns, line)) continue;
    if (line.length < 2) continue;
    fresh.push(line);
  }
  return fresh;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
