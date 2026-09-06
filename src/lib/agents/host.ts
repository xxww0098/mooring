import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
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

const VAULT_DIR = process.env.VERCEL ? "/tmp/mooring-vault" : "/workspace/vault";
const MODELS_DEV_URL = "https://models.dev/api.json";
const MODELS_DEV_CACHE = process.env.VERCEL ? "/tmp/mooring-models-dev.json" : "/workspace/.cache/models-dev.json";
const MODELS_DEV_TTL_MS = 24 * 60 * 60 * 1000;

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

function wrapPty(command: string): { bin: string; args: string[] } {
  if (existsSync("/usr/bin/script") || resolveCommand("script", extraPath())) {
    return { bin: "script", args: ["-qefc", command, "/dev/null"] };
  }
  return { bin: "/bin/sh", args: ["-lc", command] };
}

export const probeHostAgents = createServerFn({ method: "GET" }).handler(async () => {
  const pathEnv = extraPath();
  const agents = probeCatalog(pathEnv);
  const catalogs = await buildModelCatalogs(pathEnv, agents);
  return {
    ok: true as const,
    runtime: process.platform,
    agents,
    detectedIds: agents.filter((item) => item.available).map((item) => item.id),
    catalogs,
  };
});

export const probeHostCommand = createServerFn({ method: "POST" })
  .validator((input: { command: string }) => input)
  .handler(async ({ data }) => {
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
  });

export const launchHostAgent = createServerFn({ method: "POST" })
  .validator(
    (input: {
      sessionId: string;
      agentId: LaunchableAgentId;
      prompt?: string;
      vault: Record<string, string>;
      customCommand?: string;
      permissionMode?: AgentPermissionMode;
    }) => input,
  )
  .handler(async ({ data }) => {
    const pathEnv = extraPath();
    const missing = agentIsLaunchable(data.agentId, data.customCommand ?? "", pathEnv);
    if (missing) return { ok: false as const, error: missing };
    const spec =
      data.agentId === "terminal"
        ? resolveLaunchSpec("terminal")
        : resolveLaunchSpec(data.agentId, data.customCommand ?? "");
    if (!spec) return { ok: false as const, error: "未知智能体" };
    writeVault(data.vault ?? {});
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
        PATH: pathEnv,
        TERM: process.env.TERM || "xterm-256color",
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
  });

export const saveHostAttachments = createServerFn({ method: "POST" })
  .validator(
    (input: { files: Array<{ relPath: string; base64: string }> }) => input,
  )
  .handler(async ({ data }) => {
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
  });

export const writeHostAgent = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string; data: string }) => input)
  .handler(async ({ data }) => {
    const live = sessions.get(data.sessionId);
    if (!live?.child.stdin || live.child.stdin.destroyed) {
      return { ok: false as const };
    }
    live.child.stdin.write(data.data);
    return { ok: true as const };
  });

export const killHostAgent = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string }) => input)
  .handler(async ({ data }) => {
    const live = sessions.get(data.sessionId);
    if (!live) return { ok: true as const };
    live.child.kill("SIGTERM");
    setTimeout(() => live.child.kill("SIGKILL"), 800);
    live.running = false;
    return { ok: true as const };
  });

export const pollHostAgent = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string; flushStdin?: boolean }) => input)
  .handler(async ({ data }) => {
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
  });
