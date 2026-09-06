import { Search, Settings, SquareTerminal } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AgentMark } from "@/components/workspace/AgentMark";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  filterEnabledTuiAgents,
  formatLaunchDisplay,
  nextSessionName,
  orderTuiAgents,
  pickTuiAgent,
  resolveLaunchSpec,
  TUI_AGENT_BY_ID,
  type AgentPermissionMode,
  type LaunchableAgentId,
} from "@/lib/agents/catalog";
import { useAgentStore } from "@/lib/agents/store";
import { cn } from "@/lib/utils";

export type AgentLaunchInput = {
  sessionId: string;
  agentId: LaunchableAgentId;
  prompt: string;
  launchCommand: string;
  permissionMode: AgentPermissionMode;
};

function nextName(agentId: LaunchableAgentId) {
  return nextSessionName(
    agentId,
    useAgentStore.getState().agents.map((agent) => agent.name),
  );
}

export function spawnAgentSession(agentId: LaunchableAgentId): AgentLaunchInput | null {
  const { createAgent, permissionMode, defaultViewMode } = useAgentStore.getState();
  const spec = resolveLaunchSpec(agentId);
  if (!spec) return null;
  const launchCommand = formatLaunchDisplay(spec, "", permissionMode);
  const sessionId = createAgent({
    name: nextName(agentId),
    agentId,
    launchCommand,
    viewMode: defaultViewMode,
  });
  return { sessionId, agentId, prompt: "", launchCommand, permissionMode };
}

export function spawnTerminalSession(): AgentLaunchInput {
  const { createAgent, permissionMode } = useAgentStore.getState();
  const sessionId = createAgent({
    name: nextName("terminal"),
    agentId: "terminal",
    launchCommand: "$SHELL",
    viewMode: "terminal",
  });
  return {
    sessionId,
    agentId: "terminal",
    prompt: "",
    launchCommand: "$SHELL",
    permissionMode,
  };
}

export function spawnDefaultAgentSession(): AgentLaunchInput | null {
  const { defaultAgentId, detectedAgentIds, disabledAgentIds } = useAgentStore.getState();
  if (defaultAgentId === "blank") return spawnTerminalSession();
  const picked = pickTuiAgent(defaultAgentId, detectedAgentIds, disabledAgentIds);
  if (!picked) return null;
  return spawnAgentSession(picked);
}

export function NewAgentMenu({
  children,
  onLaunch,
  onOpenSettings,
  align = "end",
}: {
  children: ReactNode;
  onLaunch: (input: AgentLaunchInput) => void;
  onOpenSettings: () => void;
  align?: "start" | "center" | "end";
}) {
  const defaultAgentId = useAgentStore((s) => s.defaultAgentId);
  const detectedAgentIds = useAgentStore((s) => s.detectedAgentIds);
  const disabledAgentIds = useAgentStore((s) => s.disabledAgentIds);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const enabledIds = useMemo(
    () => orderTuiAgents(filterEnabledTuiAgents(detectedAgentIds, disabledAgentIds), defaultAgentId),
    [detectedAgentIds, disabledAgentIds, defaultAgentId],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = enabledIds.map((id) => TUI_AGENT_BY_ID[id]).filter(Boolean);
    if (!q) return rows;
    return rows.filter((spec) =>
      [spec.name, spec.id, spec.detectCmd, ...(spec.detectCmdAliases ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [enabledIds, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const launch = (agentId: LaunchableAgentId) => {
    const input = spawnAgentSession(agentId);
    if (!input) return;
    close();
    onLaunch(input);
  };

  const launchTerminal = () => {
    close();
    onLaunch(spawnTerminalSession());
  };

  const q = query.trim().toLowerCase();
  const showTerminal = !q || ["终端", "terminal", "shell", "bash", "zsh"].some((token) => token.includes(q) || q.includes(token));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="flex max-h-[min(28rem,70dvh)] w-72 flex-col overflow-hidden p-0">
        <label className="flex shrink-0 items-center gap-2 border-b border-border px-3">
          <Search className="size-3.5 text-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索智能体"
            aria-label="搜索智能体"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {showTerminal ? (
            <button
              type="button"
              title="打开本机 shell"
              onClick={launchTerminal}
              className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm text-fg hover:bg-elevated"
            >
              <SquareTerminal className="size-4 text-muted" />
              <span className="truncate">新终端</span>
            </button>
          ) : null}
          {visible.length === 0 ? (
            q && !showTerminal ? (
              <p className="px-3 py-6 text-center text-sm text-muted">没有匹配的智能体</p>
            ) : !q ? (
              <p className="px-3 py-3 text-center text-sm text-muted">还没有启用的智能体</p>
            ) : null
          ) : (
            <>
              {showTerminal ? <div className="my-1 border-t border-border" /> : null}
              {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.detectCmd}
                onClick={() => launch(item.id)}
                className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm text-fg hover:bg-elevated"
              >
                <AgentMark id={item.id} className="size-4" />
                <span className="truncate">{item.name}</span>
              </button>
              ))}
            </>
          )}
        </div>
        <div className="border-t border-border py-1">
          <button
            type="button"
            onClick={() => {
              close();
              onOpenSettings();
            }}
            className={cn(
              "flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm text-muted hover:bg-elevated hover:text-fg",
            )}
          >
            <Settings className="size-4" />
            智能体设置...
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
