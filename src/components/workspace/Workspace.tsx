import { Bot, FileText, Files } from "lucide-react";
import { useEffect, useState } from "react";
import { Group, Panel, Separator as ResizeHandle } from "react-resizable-panels";
import { useAgentStore } from "@/lib/agents/store";
import { useVaultStore } from "@/lib/vault/store";
import { cn } from "@/lib/utils";
import { AgentDock } from "./AgentDock";
import { FileTree } from "./FileTree";
import { NoteEditor } from "./NoteEditor";

type MobilePane = "files" | "note" | "agents";

export function Workspace() {
  const vaultHydrated = useVaultStore((s) => s.hydrated);
  const agentHydrated = useAgentStore((s) => s.hydrated);
  const [ready, setReady] = useState(false);
  const [pane, setPane] = useState<MobilePane>("note");

  useEffect(() => {
    const sync = () => {
      if (
        useVaultStore.persist.hasHydrated() &&
        useAgentStore.persist.hasHydrated()
      ) {
        useVaultStore.getState().setHydrated();
        useAgentStore.getState().setHydrated();
        setReady(true);
      }
    };
    sync();
    const offVault = useVaultStore.persist.onFinishHydration(sync);
    const offAgent = useAgentStore.persist.onFinishHydration(sync);
    const timer = window.setTimeout(() => setReady(true), 400);
    return () => {
      offVault();
      offAgent();
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready && !vaultHydrated && !agentHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg text-sm text-subtle">
        打开笔记库…
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-accent" />
          <h1 className="font-serif text-[15px] font-semibold tracking-tight">Mooring</h1>
        </div>
        <p className="hidden text-[12px] text-subtle sm:block">
          笔记窗口 · 宿主机 Agent
        </p>
      </header>

      <div className="hidden min-h-0 flex-1 md:flex">
        <Group orientation="horizontal" className="h-full w-full">
          <Panel id="files" defaultSize="22%" minSize="16%" className="min-w-0">
            <FileTree />
          </Panel>
          <ResizeHandle className="w-px bg-border hover:bg-accent/50 data-[separator=active]:bg-accent" />
          <Panel id="note" defaultSize="48%" minSize="30%" className="min-w-0">
            <NoteEditor />
          </Panel>
          <ResizeHandle className="w-px bg-border hover:bg-accent/50 data-[separator=active]:bg-accent" />
          <Panel id="agents" defaultSize="30%" minSize="22%" className="min-w-0">
            <AgentDock />
          </Panel>
        </Group>
      </div>

      <div className="min-h-0 flex-1 md:hidden">
        {pane === "files" ? <FileTree /> : null}
        {pane === "note" ? <NoteEditor /> : null}
        {pane === "agents" ? <AgentDock /> : null}
      </div>

      <nav className="grid h-14 shrink-0 grid-cols-3 border-t border-border bg-surface md:hidden">
        {(
          [
            ["files", Files, "笔记"],
            ["note", FileText, "编辑"],
            ["agents", Bot, "Agent"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-[11px]",
              pane === id ? "text-fg" : "text-subtle",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
