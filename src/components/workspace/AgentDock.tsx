import { MessageSquare, Plus, SquareTerminal, X } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { AgentMark } from "@/components/workspace/AgentMark";
import { Button } from "@/components/ui/button";
import { killHostAgent, launchHostAgent } from "@/lib/agents/host";
import { TUI_AGENT_BY_ID } from "@/lib/agents/catalog";
import type { AgentPermissionMode, LaunchableAgentId } from "@/lib/agents/catalog";
import { useAgentStore } from "@/lib/agents/store";
import { useHostPty } from "@/lib/agents/use-host-pty";
import type { AgentSession } from "@/lib/agents/types";
import { snapshotVault, useVaultStore } from "@/lib/vault/store";
import { cn } from "@/lib/utils";
import { AgentChat } from "./AgentChat";
import { AgentSettingsDialog } from "./AgentSettingsDialog";
import { AgentTerminal } from "./AgentTerminal";
import { NewAgentMenu, spawnDefaultAgentSession } from "./NewAgentMenu";

function ViewToggle({
  value,
  onChange,
}: {
  value: "chat" | "terminal";
  onChange: (next: "chat" | "terminal") => void;
}) {
  return (
    <div className="relative isolate flex shrink-0 rounded-full border border-border p-0.5">
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 left-0.5 size-8 rounded-full bg-elevated transition-transform duration-200 ease-out",
          value === "terminal" && "translate-x-8",
        )}
      />
      <button
        type="button"
        aria-label="对话"
        aria-pressed={value === "chat"}
        onClick={() => onChange("chat")}
        className={cn(
          "relative z-10 inline-flex size-8 items-center justify-center rounded-full transition-colors duration-200",
          value === "chat" ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        <MessageSquare className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="终端"
        aria-pressed={value === "terminal"}
        onClick={() => onChange("terminal")}
        className={cn(
          "relative z-10 inline-flex size-8 items-center justify-center rounded-full transition-colors duration-200",
          value === "terminal" ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        <SquareTerminal className="size-3.5" />
      </button>
    </div>
  );
}

function AgentSessionPane({ session }: { session: AgentSession }) {
  const pty = useHostPty(session.id, true);
  const view = session.viewMode === "terminal" ? "terminal" : "chat";
  const runtimeLabel =
    session.agentId === "custom"
      ? "custom"
      : session.agentId === "terminal"
        ? "终端"
        : (TUI_AGENT_BY_ID[session.agentId]?.detectCmd ?? session.agentId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {session.error ? <p className="px-3 py-2 text-sm text-danger">{session.error}</p> : null}
      <div className="min-h-0 flex-1">
        {session.status === "error" ? (
          <p className="px-3 py-4 text-sm text-muted">{runtimeLabel} 未能启动。</p>
        ) : (
          <>
            <div className={cn("h-full p-2", view !== "terminal" && "hidden")}>
              <AgentTerminal sessionId={session.id} visible={view === "terminal"} pty={pty} />
            </div>
            <div className={cn("h-full", view !== "chat" && "hidden")}>
              <AgentChat key={session.id} session={session} pty={pty} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AgentDock() {
  const agents = useAgentStore((s) => s.agents);
  const activeId = useAgentStore((s) => s.activeId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setViewMode = useAgentStore((s) => s.setViewMode);
  const permissionMode = useAgentStore((s) => s.permissionMode);
  const files = useVaultStore((s) => s.files);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const active = agents.find((agent) => agent.id === activeId) ?? null;

  const launch = useCallback(
    async (input: {
      sessionId: string;
      agentId: LaunchableAgentId;
      prompt: string;
      launchCommand: string;
      customCommand?: string;
      permissionMode?: AgentPermissionMode;
    }) => {
      setStatus(input.sessionId, "starting");
      const result = await launchHostAgent({
        data: {
          sessionId: input.sessionId,
          agentId: input.agentId,
          prompt: input.prompt,
          vault: snapshotVault(files),
          customCommand: input.customCommand,
          permissionMode: input.permissionMode ?? permissionMode,
        },
      });
      if (!result.ok) {
        setStatus(input.sessionId, "error", { error: result.error });
        return;
      }
      setStatus(input.sessionId, "running");
    },
    [files, permissionMode, setStatus],
  );

  const menu = (trigger: ReactNode, align: "start" | "center" | "end" = "end") => (
    <NewAgentMenu
      align={align}
      onLaunch={(input) => void launch(input)}
      onOpenSettings={() => setSettingsOpen(true)}
    >
      {trigger}
    </NewAgentMenu>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {agents.length === 0 ? (
            <p className="px-1 text-sm font-medium text-muted">Agents</p>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  "flex h-8 shrink-0 items-center rounded-sm pl-2 text-xs",
                  agent.id === activeId
                    ? "bg-elevated text-fg"
                    : "text-muted hover:bg-elevated/60 hover:text-fg",
                )}
              >
                <button
                  type="button"
                  onClick={() => selectAgent(agent.id)}
                  className="flex items-center gap-1 py-1 pr-1"
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      agent.status === "running" ? "bg-accent" : "bg-subtle",
                    )}
                  />
                  <AgentMark id={agent.agentId} className="size-3.5" />
                  {agent.name}
                </button>
                <button
                  type="button"
                  aria-label={`关闭 ${agent.name}`}
                  onClick={() => {
                    void killHostAgent({ data: { sessionId: agent.id } });
                    removeAgent(agent.id);
                  }}
                  className="mr-0.5 inline-flex size-6 items-center justify-center rounded-sm text-muted hover:text-fg"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pr-1">
          {active ? (
            <ViewToggle
              value={active.viewMode === "terminal" ? "terminal" : "chat"}
              onChange={(next) => setViewMode(active.id, next)}
            />
          ) : null}
          {menu(
            <Button size="icon-sm" className="size-7" aria-label="新建">
              <Plus className="size-3.5" />
            </Button>,
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="font-serif text-lg text-fg">还没有 Agent</p>
            <p className="max-w-64 text-sm leading-6 text-muted">
              点新建会启动默认智能体。换其他的用右上角，或先到智能体设置里刷新并启用。
            </p>
            <Button
              onClick={() => {
                const input = spawnDefaultAgentSession();
                if (!input) {
                  setSettingsOpen(true);
                  return;
                }
                void launch(input);
              }}
            >
              <Plus className="size-3.5" />
              新建
            </Button>
          </div>
        ) : (
          <AgentSessionPane session={active} />
        )}
      </div>

      <AgentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
