import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AgentMark } from "@/components/workspace/AgentMark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AgentCatalogRow } from "@/components/workspace/AgentCatalogRow";
import {
  TUI_AGENT_BY_ID,
  formatLaunchLine,
  type AgentPermissionMode,
} from "@/lib/agents/catalog";
import { useAgentStore } from "@/lib/agents/store";
import type { AgentViewMode } from "@/lib/agents/types";
import { useHostAgents } from "@/lib/agents/use-host-agents";
import { cn } from "@/lib/utils";

function Chip({
  selected,
  disabled,
  onClick,
  children,
  title,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors duration-150",
        selected
          ? "border-border-strong bg-elevated text-fg"
          : "border-border text-muted hover:border-border-strong hover:text-fg",
        disabled && "cursor-not-allowed opacity-40 hover:border-border hover:text-muted",
      )}
    >
      {children}
      {selected ? <Check className="size-3.5 shrink-0" strokeWidth={2} /> : null}
    </button>
  );
}

function PermissionModeToggle({
  value,
  onChange,
}: {
  value: AgentPermissionMode;
  onChange: (next: AgentPermissionMode) => void;
}) {
  return (
    <div
      className="relative isolate grid shrink-0 grid-cols-2 rounded-full border border-border p-0.5"
      role="group"
      aria-label="权限模式"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 left-0.5 h-8 w-[calc(50%-2px)] rounded-full bg-elevated transition-transform duration-200 ease-out",
          value === "manual" && "translate-x-full",
        )}
      />
      <button
        type="button"
        aria-pressed={value === "yolo"}
        onClick={() => onChange("yolo")}
        className={cn(
          "relative z-10 h-8 min-w-14 px-3 text-xs transition-colors duration-200",
          value === "yolo" ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        Yolo
      </button>
      <button
        type="button"
        aria-pressed={value === "manual"}
        onClick={() => onChange("manual")}
        className={cn(
          "relative z-10 h-8 min-w-14 px-3 text-xs transition-colors duration-200",
          value === "manual" ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        普通
      </button>
    </div>
  );
}

function DefaultViewSelect({
  value,
  onChange,
}: {
  value: AgentViewMode;
  onChange: (next: AgentViewMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: { id: AgentViewMode; label: string }[] = [
    { id: "terminal", label: "终端聊天" },
    { id: "chat", label: "Chat UI" },
  ];
  const current = options.find((item) => item.id === value) ?? options[1];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="默认视图"
          className="inline-flex h-9 min-w-36 shrink-0 items-center justify-between gap-2 rounded-full border border-border bg-surface px-3 text-sm text-fg hover:bg-elevated"
        >
          {current.label}
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 overflow-hidden py-1">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onChange(item.id);
              setOpen(false);
            }}
            className="flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-elevated"
          >
            <span>{item.label}</span>
            {item.id === value ? <Check className="size-3.5 text-muted" /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function AgentSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const defaultAgentId = useAgentStore((s) => s.defaultAgentId);
  const permissionMode = useAgentStore((s) => s.permissionMode);
  const defaultViewMode = useAgentStore((s) => s.defaultViewMode);
  const setDefaultAgent = useAgentStore((s) => s.setDefaultAgent);
  const setPermissionMode = useAgentStore((s) => s.setPermissionMode);
  const setDefaultViewMode = useAgentStore((s) => s.setDefaultViewMode);
  const setAgentEnabled = useAgentStore((s) => s.setAgentEnabled);
  const { probes, probing, refresh, disabledSet, available } = useHostAgents(open);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    setFilter("");
  }, [open]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return probes.filter((item) => {
      if (!q) return true;
      const spec = TUI_AGENT_BY_ID[item.id];
      const hay = [item.name, item.id, item.launchCommand, item.detectCmd, ...(spec?.detectCmdAliases ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [probes, filter]);

  const installed = visible.filter((item) => item.available);
  const installable = visible.filter((item) => !item.available);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(48rem,92dvh)] w-[min(100%-1.5rem,52rem)] flex-col overflow-hidden">
        <DialogTitle>智能体设置</DialogTitle>
        <DialogDescription>
          刷新会探测本机命令。启用后会出现在新建菜单里。没有对应命令的不能启动。
        </DialogDescription>
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
          <section className="shrink-0 space-y-2">
            <div>
              <h3 className="text-sm font-medium">默认智能体</h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                菜单只列出已启用的项。自动会选本机已检测且已启用的第一项。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip selected={defaultAgentId === "auto"} onClick={() => setDefaultAgent("auto")}>
                自动
              </Chip>
              <Chip selected={defaultAgentId === "blank"} onClick={() => setDefaultAgent("blank")}>
                <AgentMark id="blank" />
                无智能体
              </Chip>
              {available.map((item) => {
                const off = disabledSet.has(item.id);
                return (
                  <Chip
                    key={item.id}
                    selected={defaultAgentId === item.id}
                    disabled={off}
                    title={off ? "已禁用" : formatLaunchLine(TUI_AGENT_BY_ID[item.id], permissionMode)}
                    onClick={() => setDefaultAgent(item.id)}
                  >
                    <AgentMark id={item.id} />
                    {item.name}
                  </Chip>
                );
              })}
            </div>
          </section>

          <section className="shrink-0 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">默认视图</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  选择如何打开受支持智能体的新会话。新终端始终打开终端视图。
                </p>
              </div>
              <DefaultViewSelect value={defaultViewMode} onChange={setDefaultViewMode} />
            </div>
          </section>

          <section className="shrink-0 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">权限模式</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Yolo 会在启动命令里加上跳过确认的参数。普通模式不附加这些参数，沿用智能体自己的确认流程。
                </p>
              </div>
              <PermissionModeToggle value={permissionMode} onChange={setPermissionMode} />
            </div>
          </section>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="筛选 claude / grok / mcode"
              className="h-9 shrink-0"
            />
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {installed.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">已安装</h3>
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">
                        {probing ? "探测中" : `${installed.length} 已检测`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={refresh}
                      className="inline-flex h-7 items-center gap-1.5 px-1 text-xs text-muted hover:text-fg"
                    >
                      <RefreshCw className={cn("size-3", probing && "animate-spin")} />
                      {probing ? "刷新中…" : "刷新"}
                    </button>
                  </div>
                  <div className="divide-y divide-border">
                    {installed.map((item) => (
                      <AgentCatalogRow
                        key={item.id}
                        item={item}
                        spec={TUI_AGENT_BY_ID[item.id]}
                        permissionMode={permissionMode}
                        enabled={!disabledSet.has(item.id)}
                        isDefault={defaultAgentId === item.id}
                        onSetEnabled={(next) => setAgentEnabled(item.id, next)}
                        onSetDefault={() => setDefaultAgent(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted">
                  <span>{probing ? "正在探测本机智能体…" : "没有检测到已安装的智能体。"}</span>
                  <button
                    type="button"
                    onClick={refresh}
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 text-xs text-muted hover:text-fg"
                  >
                    <RefreshCw className={cn("size-3", probing && "animate-spin")} />
                    刷新
                  </button>
                </div>
              )}

              {installable.length > 0 ? (
                <div className="mt-6 space-y-1">
                  <div className="flex items-center gap-2 text-muted">
                    <h3 className="text-sm font-medium">可安装</h3>
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-xs">
                      {installable.length} 智能体
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {installable.map((item) => (
                      <AgentCatalogRow
                        key={item.id}
                        item={item}
                        spec={TUI_AGENT_BY_ID[item.id]}
                        permissionMode={permissionMode}
                        enabled={!disabledSet.has(item.id)}
                        isDefault={false}
                        onSetEnabled={(next) => setAgentEnabled(item.id, next)}
                        onSetDefault={() => setDefaultAgent(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <div className="flex shrink-0 justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              完成
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
