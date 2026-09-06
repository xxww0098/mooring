import type { LaunchableAgentId } from "./catalog.ts";

export type SlashCommand = {
  name: string;
  description: string;
  args?: boolean;
};

const SHARED: SlashCommand[] = [
  { name: "help", description: "查看可用命令" },
  { name: "clear", description: "清空当前会话" },
  { name: "compact", description: "压缩上下文" },
  { name: "model", description: "切换模型", args: true },
];

const CLAUDE: SlashCommand[] = [
  { name: "init", description: "生成项目说明" },
  { name: "memory", description: "编辑记忆文件" },
  { name: "plan", description: "进入规划模式" },
  { name: "context", description: "查看上下文用量" },
  { name: "cost", description: "查看用量" },
  { name: "doctor", description: "检查安装" },
  { name: "agents", description: "管理子智能体" },
  { name: "permissions", description: "权限模式" },
  { name: "export", description: "导出对话" },
  { name: "btw", description: "后台提问" },
];

const CODEX: SlashCommand[] = [
  { name: "status", description: "会话状态" },
  { name: "approvals", description: "审批模式" },
  { name: "resume", description: "恢复会话", args: true },
  { name: "review", description: "审查改动" },
];

const GROK: SlashCommand[] = [
  { name: "effort", description: "推理强度", args: true },
  { name: "status", description: "会话状态" },
];

const GEMINI: SlashCommand[] = [
  { name: "tools", description: "工具列表" },
  { name: "memory", description: "记忆" },
  { name: "chat", description: "对话模式" },
];

const AIDER: SlashCommand[] = [
  { name: "add", description: "加入文件", args: true },
  { name: "drop", description: "移出文件", args: true },
  { name: "ls", description: "列出文件" },
  { name: "diff", description: "查看改动" },
  { name: "undo", description: "撤销上一轮" },
  { name: "commit", description: "提交" },
  { name: "tokens", description: "用量" },
  { name: "reset", description: "重置聊天" },
  { name: "exit", description: "退出" },
];

const GOOSE: SlashCommand[] = [
  { name: "plan", description: "规划" },
  { name: "recipe", description: "配方", args: true },
];

const OPENCODE: SlashCommand[] = [
  { name: "new", description: "新会话" },
  { name: "sessions", description: "会话列表" },
  { name: "share", description: "分享" },
];

const COPILOT: SlashCommand[] = [
  { name: "login", description: "登录" },
  { name: "logout", description: "登出" },
];

const CURSOR: SlashCommand[] = [
  { name: "resume", description: "恢复会话", args: true },
  { name: "about", description: "关于" },
];

const EXTRA: Partial<Record<LaunchableAgentId, SlashCommand[]>> = {
  claude: CLAUDE,
  openclaude: CLAUDE,
  codex: CODEX,
  grok: GROK,
  gemini: GEMINI,
  antigravity: GEMINI,
  aider: AIDER,
  goose: GOOSE,
  opencode: OPENCODE,
  copilot: COPILOT,
  cursor: CURSOR,
  droid: CURSOR,
  crush: OPENCODE,
  kilo: [{ name: "mode", description: "切换模式", args: true }],
  kimi: [{ name: "status", description: "会话状态" }],
  pi: [{ name: "new", description: "新会话" }],
  omp: [{ name: "new", description: "新会话" }],
  "qwen-code": [{ name: "vim", description: "Vim 模式" }],
};

function merge(extra: SlashCommand[] = []): SlashCommand[] {
  const seen = new Set<string>();
  const out: SlashCommand[] = [];
  for (const item of [...SHARED, ...extra]) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out;
}

export function slashCommandsFor(id: LaunchableAgentId): SlashCommand[] {
  return merge(EXTRA[id]);
}

export function filterSlashCommands(id: LaunchableAgentId, query: string): SlashCommand[] {
  const q = query.trim().toLowerCase().replace(/^\//, "");
  return slashCommandsFor(id)
    .filter((item) => !q || item.name.includes(q) || item.description.includes(q))
    .slice(0, 8);
}
