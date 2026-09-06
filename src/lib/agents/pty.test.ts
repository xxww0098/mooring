import assert from "node:assert/strict";
import test from "node:test";
import { getAgentChatProfile } from "./chat-profile.ts";
import { TUI_AGENTS } from "./catalog.ts";
import {
  buildFollowupBody,
  collectChatLines,
  followupSubmit,
  ingestChatLines,
  isComposerReady,
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
