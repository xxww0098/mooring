import assert from "node:assert/strict";
import test from "node:test";
import {
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedTuiAgentIds,
} from "./detect-catalog.ts";
import { filterEnabledTuiAgents, orderTuiAgents, pickTuiAgent, TUI_AGENT_AUTO_PICK_ORDER, TUI_AGENT_BY_ID, buildLaunchCommand, formatLaunchDisplay, formatLaunchLine, nextSessionName } from "./catalog.ts";

test("probe list includes detectCmd, aliases, and required commands", () => {
  const probes = getTuiAgentDetectionProbeCommands(
    KNOWN_TUI_AGENT_DETECTION_COMMANDS,
    "linux",
  );
  assert.ok(probes.includes("claude"));
  assert.ok(probes.includes("grok"));
  assert.ok(probes.includes("traecli"));
  assert.ok(probes.includes("mistral-vibe"));
});

test("win32 still probes common clis", () => {
  const win = getTuiAgentDetectionProbeCommands(
    KNOWN_TUI_AGENT_DETECTION_COMMANDS,
    "win32",
  );
  assert.ok(win.includes("claude"));
  assert.ok(win.includes("grok"));
});

test("an agent is detected only when a detectCmd/alias exists", () => {
  const commands = KNOWN_TUI_AGENT_DETECTION_COMMANDS;
  assert.deepEqual(
    resolveDetectedTuiAgentIds(commands, new Set(["claude"]), "linux"),
    ["claude"],
  );
  assert.deepEqual(
    resolveDetectedTuiAgentIds(commands, new Set(["unknown-bin"]), "linux"),
    [],
  );
});

test("aliases count as the same agent", () => {
  const ids = resolveDetectedTuiAgentIds(
    KNOWN_TUI_AGENT_DETECTION_COMMANDS,
    new Set(["minimax-code"]),
    "linux",
  );
  assert.deepEqual(ids, ["minimax-code"]);
});

test("pickTuiAgent honors default, then auto order, then blank", () => {
  assert.equal(pickTuiAgent("grok", ["codex", "grok"], []), "grok");
  assert.equal(pickTuiAgent("claude", ["grok"], []), "grok");
  assert.equal(pickTuiAgent("auto", ["grok", "pi"], []), "grok");
  assert.equal(pickTuiAgent("blank", ["grok"], []), null);
  assert.equal(pickTuiAgent("grok", ["grok"], ["grok"]), null);
  assert.ok(TUI_AGENT_AUTO_PICK_ORDER.includes("grok"));
});

test("menu rows are detected minus disabled, default first", () => {
  assert.deepEqual(filterEnabledTuiAgents(["claude", "grok"], ["claude"]), ["grok"]);
  assert.deepEqual(orderTuiAgents(["grok", "claude"], "grok"), ["grok", "claude"]);
  assert.deepEqual(orderTuiAgents(["grok", "pi"], "auto"), ["grok", "pi"]);
});

test("yolo mode appends bypass args and env; manual does not", () => {
  const grok = TUI_AGENT_BY_ID.grok;
  const claude = TUI_AGENT_BY_ID.claude;
  const goose = TUI_AGENT_BY_ID.goose;
  assert.match(buildLaunchCommand(grok, "", "yolo").command, /bypassPermissions/);
  assert.equal(buildLaunchCommand(grok, "", "manual").command, "grok");
  assert.match(buildLaunchCommand(claude, "", "yolo").command, /dangerously-skip-permissions/);
  assert.equal(buildLaunchCommand(claude, "", "manual").command, "claude");
  assert.equal(buildLaunchCommand(goose, "", "yolo").env.GOOSE_MODE, "auto");
  assert.deepEqual(buildLaunchCommand(goose, "", "manual").env, {});
  assert.match(formatLaunchDisplay(goose, "", "yolo"), /GOOSE_MODE/);
  assert.equal(formatLaunchDisplay(goose, "", "manual"), "goose");
  assert.equal(
    formatLaunchLine(claude, "yolo"),
    "claude --dangerously-skip-permissions",
  );
  assert.equal(formatLaunchLine(claude, "manual"), "claude");
  assert.equal(formatLaunchLine(grok, "yolo"), "grok --permission-mode bypassPermissions");
});

test("session tabs use agent name then increment", () => {
  assert.equal(nextSessionName("grok", []), "Grok");
  assert.equal(nextSessionName("grok", ["Grok"]), "Grok 2");
  assert.equal(nextSessionName("grok", ["Grok", "Grok 2"]), "Grok 3");
  assert.equal(nextSessionName("terminal", []), "终端");
  assert.equal(nextSessionName("claude", ["Grok"]), "Claude");
});
