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

// Structural chrome, the part no per-agent pattern list keeps up with: composer echo,
// key-hint strips, spinner/timer frames, counters, and rows that carry no words at all.
const KEY_HINT_RE = /(?:ctrl|opt|alt|shift|cmd|esc|tab|enter)\s*\+?\s*[\w+;]*\s*:/gi;
const TIMER_RE = /\d+(?:\.\d+)?\s*s\b/;
const COUNTER_RE = /^[\s\d.,%/()]*[kKmM]?[\s\d.,%/()]*$/;
const WORD_RE = /[\p{L}\p{N}]/u;

export function isChromeLine(line: string, chromePatterns: readonly string[]): boolean {
  const text = line.trim();
  if (!text) return true;
  if (!WORD_RE.test(text)) return true;
  if (COUNTER_RE.test(text)) return true;
  if ((text.match(KEY_HINT_RE) ?? []).length >= 2) return true;
  if (/\bhooks?:\s*\d+\/\d+/i.test(text)) return true;
  // The reference block Mooring itself appends to the prompt, echoed by the composer.
  if (/^引用[:：]/.test(text) || /^-\s*(笔记|技能)\s+\S/.test(text)) return true;
  // A token meter ("1.5K / 500K") belongs to the status bar, not the answer.
  if (/\d[\d.,]*\s*[kKmM]\s*\/\s*\d[\d.,]*\s*[kKmM]/.test(text)) return true;
  if (/^(thinking|reasoning|working|waiting|loading|compacting)[.…\s]*$/i.test(text)) return true;
  // "Thought for 3s, 455 tokens" / "Worked for 12s" — the timer line every agent prints.
  if (/^[▸▹>*·•\s]*(thought|thinking|reasoned|worked|brewed|cooked|ran)\s+for\s+\d/i.test(text)) return true;
  if (/·\s*(always|auto)-approve|·\s*(bypass|read-only|plan mode)/i.test(text)) return true;
  if (/[…⋯]/.test(text) && TIMER_RE.test(text)) return true;
  return lineMatches(chromePatterns, text);
}

/** Filter whole screen rows (already free of escape codes) down to transcript text. */
const TRAILING_CLOCK_RE = /\s{2,}\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp][Mm])?\s*$/;

/**
 * Filter whole screen rows (already free of escape codes) into `into`. Appending in
 * place is what lets a row the terminal wrapped rejoin the sentence it continues, even
 * when the two halves arrive in different writes.
 */
const SENTENCE_END_RE = /[.!?。．！？：:;；、,，)\]}」』”"']$/;

/** CJK cells are two columns wide; a wrapped row is one that filled the screen. */
function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += (char.codePointAt(0) ?? 0) > 0x1100 ? 2 : 1;
  return width;
}

const THINKING_TIMER_RE =
  /^[\u25b8\u25b9>*\u00b7\u2022\s]*(?:thought|thinking|reasoned|worked|brewed|cooked|ran)\s+for\s+(\d+(?:\.\d+)?)\s*s/i;

/** How long the agent said it thought, from its own timer line. */
export function parseThinkingDuration(rows: readonly { text: string }[]): string | null {
  for (const { text } of rows) {
    const match = text.trim().match(THINKING_TIMER_RE);
    if (match) return `${match[1]}s`;
  }
  return null;
}

export function appendTranscriptLines(
  rows: readonly { text: string; dim: boolean; wrapped?: boolean }[],
  profile: AgentChatProfile,
  seen: Set<string>,
  userText: string,
  into: string[],
  cols = 0,
  thinking?: string[],
): number {
  let added = 0;
  const user = userText.trim();
  for (const row of rows) {
    if (row.dim && !thinking) continue;
    const line = row.text
      .replace(BOX_RE, "")
      .replace(SPINNER_RE, "")
      .replace(TRAILING_CLOCK_RE, "")
      .replace(/[ \t]+$/g, "")
      .trim();
    if (!line || line.length < 2) continue;
    if (/^[>|❯▶➜]/.test(line)) continue;
    // The composer echoes the prompt, wrapped across rows, before the answer starts.
    if (user && (line.includes(user) || (line.length >= 6 && user.includes(line)))) continue;
    if (isChromeLine(line, profile.chromePatterns)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    // Reasoning is drawn dim; it belongs in its own collapsed block, not in the answer.
    if (row.dim) {
      thinking?.push(line);
      continue;
    }
    const previous = into.at(-1);
    // A row still being drawn settles at a prefix of its final text; keep the longer one.
    if (previous !== undefined && line.startsWith(previous) && line.length > previous.length) {
      into[into.length - 1] = line;
      added += 1;
      continue;
    }
    if (previous !== undefined && previous.startsWith(line)) continue;
    // The terminal wrapped it, or the agent hard-wrapped its own prose at the screen
    // edge: either way the sentence continues rather than starting a new line.
    const continues =
      previous !== undefined &&
      (row.wrapped ||
        (cols > 0 &&
          displayWidth(previous) >= cols * 0.6 &&
          !SENTENCE_END_RE.test(previous) &&
          !/^[-*#>\d]/.test(line)));
    if (continues) into[into.length - 1] += line;
    else into.push(line);
    added += 1;
  }
  return added;
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

const UNIT: Record<string, number> = { k: 1e3, m: 1e6 };
const USAGE_RE = /(\d[\d.,]*)\s*([kKmM])?\s*(?:tokens?\s*)?\/\s*(\d[\d.,]*)\s*([kKmM])?/g;
const LEFT_RE = /(?:context|上下文)[^0-9%]{0,40}(\d{1,3})\s*%/i;

function scale(value: string, unit?: string): number {
  const base = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(base)) return NaN;
  return base * (unit ? (UNIT[unit.toLowerCase()] ?? 1) : 1);
}

/** Read the agent's own context meter off the screen; nothing is guessed here. */
export function parseContextUsage(
  rows: readonly { text: string }[],
): { used: number; limit: number } | null {
  for (const { text: row } of rows) {
    const left = row.match(LEFT_RE);
    if (left) {
      const remaining = Number(left[1]);
      if (remaining >= 0 && remaining <= 100) return { used: 100 - remaining, limit: 100 };
    }
    for (const pair of row.matchAll(USAGE_RE)) {
      const used = scale(pair[1], pair[2]);
      const limit = scale(pair[3], pair[4]);
      // A real context meter is thousands of tokens wide; "MCP (1/2)" is not one.
      if (limit >= 1000 && used >= 0 && used <= limit) return { used, limit };
    }
  }
  return null;
}
