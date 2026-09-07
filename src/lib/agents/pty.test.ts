import assert from "node:assert/strict";
import test from "node:test";
import { getAgentChatProfile, supportsChatUi } from "./chat-profile.ts";
import { TUI_AGENTS } from "./catalog.ts";
import {
  buildFollowupBody,
  collectChatLines,
  followupSubmit,
  ingestChatLines,
  isComposerReady,
  appendTranscriptLines,
  parseContextUsage,
  stripAnsi,
} from "./pty.ts";

test("every catalog agent has a chat profile", () => {
  for (const spec of TUI_AGENTS) {
    const profile = getAgentChatProfile(spec.id);
    assert.equal(profile.id, spec.id);
    assert.ok(profile.followup === "paste-cr" || profile.followup === "plain-cr" || profile.followup === "plain-lf");
  }
  assert.equal(getAgentChatProfile("custom").surface, "repl");
});

test("only profiled agents get the chat view; the rest are terminal-only", () => {
  assert.equal(supportsChatUi("claude"), true);
  assert.equal(supportsChatUi("grok"), true);
  // A ready prompt alone (aider, copilot, cursor …) does not make the scrape hold up.
  assert.equal(supportsChatUi("aider"), false);
  assert.equal(supportsChatUi("copilot"), false);
  assert.equal(supportsChatUi("gemini"), false);
  assert.equal(supportsChatUi("custom"), false);
  assert.equal(supportsChatUi("terminal"), false);
});

test("tui agents paste then submit cr; repl agents use newline", () => {
  assert.equal(getAgentChatProfile("grok").followup, "paste-cr");
  assert.equal(getAgentChatProfile("claude").followup, "paste-cr");
  assert.equal(getAgentChatProfile("codex").followup, "paste-cr");
  assert.equal(getAgentChatProfile("aider").followup, "plain-lf");
  assert.equal(getAgentChatProfile("goose").followup, "plain-lf");
  assert.equal(getAgentChatProfile("custom").followup, "plain-lf");
  const paste = buildFollowupBody("hello\x1b world", "paste-cr");
  assert.equal(paste.startsWith("\x1b[200~"), true);
  assert.equal(paste.includes("hello world"), true);
  assert.equal(paste.endsWith("\x1b[201~"), true);
  assert.equal(followupSubmit("paste-cr"), "\r");
  assert.equal(followupSubmit("plain-lf"), "\n");
});

test("clean lines drop ansi, boxes, and duplicate redraws", () => {
  assert.equal(stripAnsi("\x1b[32mhi\x1b[0m"), "hi");
  const lines = collectChatLines("\x1b[32mhi\x1b[0m\n┌──┐\nhi\nanswer\n");
  assert.deepEqual(lines, ["hi", "answer"]);
});

test("ingest skips chrome and user echo, keeps new assistant text", () => {
  const profile = getAgentChatProfile("grok");
  const seen = new Set<string>();
  const first = ingestChatLines("Grok Code\nAsk Grok to build\nShortcuts\n", profile, seen, "");
  assert.equal(first.length, 0);
  const next = ingestChatLines("Ask Grok to build\nI am Grok.\n", profile, seen, "hi");
  assert.deepEqual(next, ["I am Grok."]);
});

test("composer ready matches grok splash", () => {
  const profile = getAgentChatProfile("grok");
  assert.equal(isComposerReady("Welcome\nAsk Grok to build, fix anything\n", profile), true);
  assert.equal(isComposerReady("$ grok --permission-mode bypassPermissions\n", profile), false);
});

const row = (text: string, extra: { dim?: boolean; wrapped?: boolean } = {}) => ({
  text,
  dim: extra.dim ?? false,
  wrapped: extra.wrapped ?? false,
});

test("screen rows keep the answer and drop the tui chrome around it", () => {
  const profile = getAgentChatProfile("grok");
  const seen = new Set<string>();
  const kept: string[] = [];
  appendTranscriptLines(
    [
      row("❯ 用一句话解释什么是 PTY"),
      row("user_prompt_submit  [hooks: 1/1]"),
      row("Thinking…", { dim: true }),
      row("Enter:send    Opt+Enter:newline    Shift+Tab:mode"),
      row("MCP (1/2)  1.5K / 500K"),
      row("PTY 是操作系统提供的一对虚拟终端设备，                     5:40 PM"),
      row("让程序像连着真实终端一样读写。", { wrapped: true }),
      row("Grok 4.6 (xhigh) · always-approve", { dim: true }),
    ],
    profile,
    seen,
    "用一句话解释什么是 PTY",
    kept,
  );
  assert.deepEqual(kept, [
    "PTY 是操作系统提供的一对虚拟终端设备，让程序像连着真实终端一样读写。",
  ]);
});

test("context meter is read from the agent, and counters are not mistaken for one", () => {
  assert.deepEqual(parseContextUsage([row("MCP (1/2)  22.0K / 500K")]), { used: 22000, limit: 500000 });
  assert.deepEqual(parseContextUsage([row("Context left until auto-compact: 45%")]), { used: 55, limit: 100 });
  assert.equal(parseContextUsage([row("MCP (1/2)"), row("hooks: 1/1")]), null);
});

test("a line the agent hard-wrapped at the screen edge rejoins its sentence", () => {
  const profile = getAgentChatProfile("grok");
  const into: string[] = [];
  appendTranscriptLines(
    [
      row("/dev/ptmx 是主端复用器：每次 open() 内核就分配一对新的伪终端，把主端交给调用者。/"),
      row("dev/pts/N 是这次分配的从端节点。"),
      row("- 列表项不会被并进上一行"),
    ],
    profile,
    new Set<string>(),
    "",
    into,
    60,
  );
  assert.equal(into.length, 2);
  assert.ok(into[0].endsWith("从端节点。"));
  assert.equal(into[1], "- 列表项不会被并进上一行");
});

test("a row captured mid-draw is replaced by its finished text, not duplicated", () => {
  const profile = getAgentChatProfile("grok");
  const seen = new Set<string>();
  const into: string[] = [];
  appendTranscriptLines([row("PTY 是一对由软件")], profile, seen, "", into);
  appendTranscriptLines([row("PTY 是一对由软件模拟的虚拟终端设备。")], profile, seen, "", into);
  appendTranscriptLines([row("▸ Thought for 3s, 455 tokens")], profile, seen, "", into);
  assert.deepEqual(into, ["PTY 是一对由软件模拟的虚拟终端设备。"]);
});
