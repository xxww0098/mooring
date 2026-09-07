import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import {
  firstToken,
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedTuiAgentIds,
} from "./detect-catalog";
import {
  buildLaunchCommand,
  formatLaunchDisplay,
  getTuiAgentDetectCommands,
  resolveLaunchSpec,
  TUI_AGENT_BY_ID,
  TUI_AGENTS,
  type AgentPermissionMode,
  type LaunchableAgentId,
  type TuiAgent,
} from "./catalog";
import type { AgentMissingReason, HostAgentProbe } from "./types";
import {
  familiesForAgent,
  parseGrokModelsOutput,
  parseModelsDevApi,
  snapshotApi,
  type CatalogFamily,
  type ModelsDevApi,
} from "./models-catalog";

let VAULT_DIR = process.env.VERCEL ? "/tmp/mooring-vault" : "/workspace/vault";
let MODELS_DEV_CACHE = process.env.VERCEL ? "/tmp/mooring-models-dev.json" : "/workspace/.cache/models-dev.json";
const MODELS_DEV_URL = "https://models.dev/api.json";
const MODELS_DEV_TTL_MS = 24 * 60 * 60 * 1000;
let writeVaultOnLaunch = true;

export function configureHost(options: { vaultDir?: string; cacheDir?: string; writeVaultOnLaunch?: boolean }) {
  if (options.vaultDir) VAULT_DIR = options.vaultDir;
  if (options.cacheDir) MODELS_DEV_CACHE = join(options.cacheDir, "models-dev.json");
  if (options.writeVaultOnLaunch !== undefined) writeVaultOnLaunch = options.writeVaultOnLaunch;
}

export function hostVaultDir(): string {
  return VAULT_DIR;
}

type LiveSession = {
  child: ChildProcess;
  chunks: string[];
  running: boolean;
  exitCode: number | null;
  pendingStdin: string | null;
};

const sessions: Map<string, LiveSession> = ((globalThis as { __mooringPty?: Map<string, LiveSession> })
  .__mooringPty ??= new Map());

function knownInstallDirs(home: string): string[] {
  const nvmBin = process.env.NVM_BIN;
  const dirs = [
    join(process.cwd(), "node_modules", ".bin"),
    join(home, ".grok", "bin"),
    join(home, ".opencode", "bin"),
    join(home, ".local", "bin"),
    join(home, ".npm-global", "bin"),
    join(home, ".volta", "bin"),
    join(home, ".asdf", "shims"),
    join(home, ".mise", "shims"),
    join(home, ".fnm"),
    join(home, ".cargo", "bin"),
    join(home, "go", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  if (nvmBin) dirs.push(nvmBin);
  return dirs.filter((dir, index) => dirs.indexOf(dir) === index);
}

function extraPath(): string {
  return [...knownInstallDirs(homedir()), process.env.PATH ?? ""].join(":");
}

function isExecutableFile(path: string): boolean {
  try {
    const st = statSync(path);
    if (!st.isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findCommandOnPath(cmd: string, pathEnv: string): string | null {
  if (!cmd) return null;
  if (cmd.includes("/") || cmd.includes("\\")) {
    return isAbsolute(cmd) && isExecutableFile(cmd) ? cmd : null;
  }
  for (const dir of pathEnv.split(":")) {
    if (!dir || !isAbsolute(dir)) continue;
    const full = join(dir, cmd);
    if (isExecutableFile(full)) return full;
  }
  return null;
}

function findCommandInInstallDirs(cmd: string): string | null {
  for (const dir of knownInstallDirs(homedir())) {
    if (!existsSync(dir)) continue;
    const full = join(dir, cmd);
    if (isExecutableFile(full)) return full;
  }
  return null;
}

function resolveCommand(cmd: string, pathEnv: string): string | null {
  return findCommandOnPath(cmd, pathEnv) ?? findCommandInInstallDirs(cmd);
}

function detectFoundCommands(pathEnv: string): {
  found: Set<string>;
  resolved: Map<string, string>;
} {
  const runtime = process.platform;
  const probeCommands = getTuiAgentDetectionProbeCommands(
    KNOWN_TUI_AGENT_DETECTION_COMMANDS,
    runtime,
  );
  const found = new Set<string>();
  const resolved = new Map<string, string>();
  const missed: string[] = [];
  for (const cmd of probeCommands) {
    const path = findCommandOnPath(cmd, pathEnv);
    if (path) {
      found.add(cmd);
      resolved.set(cmd, path);
    } else {
      missed.push(cmd);
    }
  }
  for (const cmd of missed) {
    const path = findCommandInInstallDirs(cmd);
    if (path) {
      found.add(cmd);
      resolved.set(cmd, path);
    }
  }
  return { found, resolved };
}

function probeCatalog(pathEnv: string): HostAgentProbe[] {
  const runtime = process.platform;
  const { found, resolved } = detectFoundCommands(pathEnv);
  const detected = new Set(
    resolveDetectedTuiAgentIds(KNOWN_TUI_AGENT_DETECTION_COMMANDS, found, runtime),
  );
  return TUI_AGENTS.map((spec) => {
    const id = spec.id as TuiAgent;
    const detectCommands = getTuiAgentDetectCommands(spec);
    const required = spec.detectRequiredCommands ?? [];
    const resolvedCmd = detectCommands.find((cmd) => found.has(cmd)) ?? null;
    const available = detected.has(id);
    let missingReason: AgentMissingReason | null = null;
    let missingDetail: string | null = null;
    if (!available) {
      if (spec.detectUnsupportedRuntimes?.includes(runtime)) {
        missingReason = "unsupported-runtime";
        missingDetail = `当前运行时 ${runtime} 不支持`;
      } else if (!resolvedCmd) {
        missingReason = "not-on-path";
        missingDetail = `PATH 上没有 ${detectCommands.join(" / ")}`;
      } else {
        const missing = required.filter((cmd) => !found.has(cmd));
        missingReason = "missing-required";
        missingDetail = `还需要 ${missing.join(" / ")}`;
      }
    }
    return {
      id,
      name: spec.name,
      launchCommand: formatLaunchDisplay(spec),
      detectCmd: spec.detectCmd,
      detectCommands,
      requiredCommands: [...required],
      available,
      resolvedPath: resolvedCmd ? (resolved.get(resolvedCmd) ?? null) : null,
      resolvedCmd,
      missingReason,
      missingDetail,
      yolo: Boolean(spec.yoloArgs) || Boolean(spec.yoloEnv),
    };
  }).sort((a, b) => Number(b.available) - Number(a.available));
}

function writeVault(files: Record<string, string>) {
  mkdirSync(VAULT_DIR, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(VAULT_DIR, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, "utf8");
  }
}

function collectMarkdown(dir: string, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const st = statSync(full);
    if (st.isDirectory()) Object.assign(out, collectMarkdown(full, rel));
    else if (name.endsWith(".md")) out[rel] = readFileSync(full, "utf8");
  }
  return out;
}

function hostShellCommand(pathEnv: string): string {
  const shell = process.env.SHELL?.trim();
  if (shell) {
    if (shell.includes("/") || shell.includes("\\")) {
      if (isExecutableFile(shell)) return shell;
    } else if (resolveCommand(shell, pathEnv)) {
      return shell;
    }
  }
  if (resolveCommand("bash", pathEnv)) return "bash -l";
  if (resolveCommand("zsh", pathEnv)) return "zsh -l";
  if (resolveCommand("sh", pathEnv)) return "sh";
  return "/bin/sh";
}

function agentIsLaunchable(agentId: LaunchableAgentId, customCommand: string, pathEnv: string): string | null {
  if (agentId === "terminal") return null;
  if (agentId === "custom") {
    const token = firstToken(customCommand);
    if (!token) return "输入自定义启动命令";
    if (!resolveCommand(token, pathEnv)) return `本机没有 ${token}`;
    return null;
  }
  const spec = TUI_AGENT_BY_ID[agentId];
  if (!spec) return "Unknown agent";
  const { found } = detectFoundCommands(pathEnv);
  const detected = resolveDetectedTuiAgentIds(
    KNOWN_TUI_AGENT_DETECTION_COMMANDS,
    found,
    process.platform,
  );
  if (!detected.includes(agentId)) {
    const cmds = getTuiAgentDetectCommands(spec).join(" / ");
    return `本机未安装 ${spec.name}（需要 ${cmds}）`;
  }
  return null;
}

function runTimed(bin: string, args: string[], pathEnv: string, ms = 8000): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      env: { ...process.env, PATH: pathEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(out);
    }, ms);
    child.stdout?.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      out += String(chunk);
    });
    const done = () => {
      clearTimeout(timer);
      resolve(out);
    };
    child.on("close", done);
    child.on("error", done);
  });
}

async function loadModelsDevApi(): Promise<ModelsDevApi> {
  try {
    if (existsSync(MODELS_DEV_CACHE)) {
      const st = statSync(MODELS_DEV_CACHE);
      if (Date.now() - st.mtimeMs < MODELS_DEV_TTL_MS) {
        const parsed = parseModelsDevApi(JSON.parse(readFileSync(MODELS_DEV_CACHE, "utf8")));
        if (parsed) return parsed;
      }
    }
  } catch {
    // network
  }
  try {
    const response = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(12000) });
    if (response.ok) {
      const parsed = parseModelsDevApi(await response.json());
      if (parsed) {
        mkdirSync(dirname(MODELS_DEV_CACHE), { recursive: true });
        writeFileSync(MODELS_DEV_CACHE, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch {
    // snapshot
  }
  try {
    if (existsSync(MODELS_DEV_CACHE)) {
      const parsed = parseModelsDevApi(JSON.parse(readFileSync(MODELS_DEV_CACHE, "utf8")));
      if (parsed) return parsed;
    }
  } catch {
    // ignore
  }
  return snapshotApi();
}

async function hostGrokModelIds(pathEnv: string, grokBin: string | null): Promise<string[]> {
  if (!grokBin) return [];
  const jsonOut = await runTimed(grokBin, ["models", "--json"], pathEnv);
  const fromJson = parseGrokModelsOutput(jsonOut);
  if (fromJson.length) return fromJson;
  return parseGrokModelsOutput(await runTimed(grokBin, ["models"], pathEnv));
}

async function buildModelCatalogs(
  pathEnv: string,
  agents: HostAgentProbe[],
): Promise<Partial<Record<LaunchableAgentId, CatalogFamily[]>>> {
  const api = await loadModelsDevApi();
  const grok = agents.find((item) => item.id === "grok" && item.available);
  const grokIds = grok ? await hostGrokModelIds(pathEnv, grok.resolvedPath ?? grok.resolvedCmd) : [];
  const catalogs: Partial<Record<LaunchableAgentId, CatalogFamily[]>> = {};
  for (const agent of agents) {
    if (!agent.available) continue;
    const families = familiesForAgent(agent.id, api, agent.id === "grok" ? grokIds : []);
    if (families.length) catalogs[agent.id] = families;
  }
  if (!catalogs.grok) catalogs.grok = familiesForAgent("grok", api, grokIds);
  return catalogs;
}

/** Escape sequence the client uses to resize the pty; a TUI never emits it. */
export const PTY_RESIZE_PREFIX = "\x1b]777;mooring-resize;";

// expect owns the pty, so a plain SIGWINCH cannot reach it. `interact` watches our own
// stdin for the resize sequence above and runs stty on the slave, which makes the TUI
// redraw at the size the visible terminal actually has.
const EXPECT_PTY_SCRIPT = [
  'set stty_init "raw -echo rows 40 columns 120"',
  "spawn -noecho sh -lc $env(MOORING_PTY_CMD)",
  "set slave $spawn_out(slave,name)",
  "interact {",
  "  -re {\x1b]777;mooring-resize;([0-9]+)x([0-9]+)\x07} {",
  "    catch {exec stty rows $interact_out(2,string) columns $interact_out(1,string) < $slave}",
  "  }",
  "}",
].join("\n");

function wrapPty(command: string): { bin: string; args: string[]; env: Record<string, string> } {
  // BSD script needs a tty on its own stdin; spawned from an app it gets a socket and
  // dies with "tcgetattr/ioctl: Operation not supported on socket". expect allocates the
  // pty itself, so it survives piped stdio. The command travels in the environment to
  // keep Tcl quoting out of it.
  if (process.platform === "darwin" && existsSync("/usr/bin/expect")) {
    return { bin: "/usr/bin/expect", args: ["-c", EXPECT_PTY_SCRIPT], env: { MOORING_PTY_CMD: command } };
  }
  if (existsSync("/usr/bin/script") || resolveCommand("script", extraPath())) {
    return { bin: "script", args: ["-qefc", command, "/dev/null"], env: {} };
  }
  return { bin: "/bin/sh", args: ["-lc", command], env: {} };
}

// Detection is a PATH scan and must never wait on the network or on `grok models`;
// the catalogs come back separately so the settings list paints immediately.
export async function probeHostAgents() {
  const agents = probeCatalog(extraPath());
  return {
    ok: true as const,
    runtime: process.platform,
    agents,
    detectedIds: agents.filter((item) => item.available).map((item) => item.id),
  };
}

export async function loadHostModelCatalogs() {
  const pathEnv = extraPath();
  try {
    return { ok: true as const, catalogs: await buildModelCatalogs(pathEnv, probeCatalog(pathEnv)) };
  } catch {
    return { ok: true as const, catalogs: {} };
  }
}

export async function probeHostCommand(data: { command: string }) {
  const token = firstToken(data.command);
  if (!token) {
    return { ok: true as const, available: false, token: "", resolvedPath: null as string | null };
  }
  const resolvedPath = resolveCommand(token, extraPath());
  return {
    ok: true as const,
    available: Boolean(resolvedPath),
    token,
    resolvedPath,
  };
}

export async function launchHostAgent(data: {
  sessionId: string;
  agentId: LaunchableAgentId;
  prompt?: string;
  vault?: Record<string, string>;
  customCommand?: string;
  permissionMode?: AgentPermissionMode;
}) {
  const pathEnv = extraPath();
  const missing = agentIsLaunchable(data.agentId, data.customCommand ?? "", pathEnv);
  if (missing) return { ok: false as const, error: missing };
  const spec =
    data.agentId === "terminal"
      ? resolveLaunchSpec("terminal")
      : resolveLaunchSpec(data.agentId, data.customCommand ?? "");
  if (!spec) return { ok: false as const, error: "未知智能体" };
  if (writeVaultOnLaunch) writeVault(data.vault ?? {});
  const prompt = data.prompt ?? "";
  const launch =
    data.agentId === "terminal"
      ? { command: hostShellCommand(pathEnv), env: {} as Record<string, string> }
      : buildLaunchCommand(spec, prompt, data.permissionMode ?? "yolo");
  const previous = sessions.get(data.sessionId);
  previous?.child.kill("SIGKILL");
  const wrapped = wrapPty(launch.command);
  const child = spawn(wrapped.bin, wrapped.args, {
    cwd: VAULT_DIR,
    env: {
      ...process.env,
      ...launch.env,
      ...wrapped.env,
      PATH: pathEnv,
      TERM: process.env.TERM || "xterm-256color",
      LANG: process.env.LANG || "en_US.UTF-8",
      COLUMNS: "120",
      LINES: "40",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const live: LiveSession = {
    child,
    chunks: [],
    running: true,
    exitCode: null,
    pendingStdin: spec.promptInjectionMode === "stdin-after-start" && prompt.trim() ? `${prompt.trim()}\n` : null,
  };
  const push = (chunk: Buffer | string) => {
    live.chunks.push(String(chunk));
  };
  child.stdout?.on("data", push);
  child.stderr?.on("data", push);
  child.on("error", (error) => {
    live.running = false;
    live.chunks.push(error.message);
  });
  child.on("close", (code) => {
    live.running = false;
    live.exitCode = code;
  });
  sessions.set(data.sessionId, live);
  return { ok: true as const };
}

export async function saveHostAttachments(data: { files: Array<{ relPath: string; base64: string }> }) {
  const saved: string[] = [];
  for (const file of data.files) {
    const rel = file.relPath.replace(/^\/+/, "").replace(/\.\./g, "");
    if (!rel.startsWith("attachments/")) continue;
    const dest = join(VAULT_DIR, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(file.base64, "base64"));
    saved.push(rel);
  }
  return { ok: true as const, saved };
}

export async function writeHostAgent(data: { sessionId: string; data: string }) {
  const live = sessions.get(data.sessionId);
  if (!live?.child.stdin || live.child.stdin.destroyed) {
    return { ok: false as const };
  }
  live.child.stdin.write(data.data);
  return { ok: true as const };
}

/** Sessions outlive the window otherwise: the children are reparented, not killed. */
export function killAllHostAgents() {
  for (const live of sessions.values()) {
    live.running = false;
    live.child.kill("SIGTERM");
  }
  sessions.clear();
}

export async function resizeHostAgent(data: { sessionId: string; cols: number; rows: number }) {
  const live = sessions.get(data.sessionId);
  if (!live?.running) return { ok: false as const };
  const cols = Math.max(20, Math.min(500, Math.round(data.cols)));
  const rows = Math.max(5, Math.min(200, Math.round(data.rows)));
  live.child.stdin?.write(`${PTY_RESIZE_PREFIX}${cols}x${rows}\x07`);
  return { ok: true as const };
}

export async function killHostAgent(data: { sessionId: string }) {
  const live = sessions.get(data.sessionId);
  if (!live) return { ok: true as const };
  live.child.kill("SIGTERM");
  setTimeout(() => live.child.kill("SIGKILL"), 800);
  live.running = false;
  return { ok: true as const };
}

export async function pollHostAgent(data: { sessionId: string; flushStdin?: boolean }) {
  const live = sessions.get(data.sessionId);
  if (!live) {
    return {
      ok: false as const,
      output: "",
      running: false,
      writable: false,
      exitCode: null as number | null,
      vault: null as Record<string, string> | null,
    };
  }
  if (data.flushStdin && live.pendingStdin && live.child.stdin && !live.child.stdin.destroyed) {
    live.child.stdin.write(live.pendingStdin);
    live.pendingStdin = null;
  }
  const output = live.chunks.splice(0).join("");
  return {
    ok: true as const,
    output,
    running: live.running,
    writable: Boolean(live.child.stdin && !live.child.stdin.destroyed),
    exitCode: live.exitCode,
    vault: collectMarkdown(VAULT_DIR),
  };
}
