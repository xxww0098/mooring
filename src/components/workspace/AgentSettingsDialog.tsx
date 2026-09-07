import { Check, ChevronDown, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AgentMark } from "@/components/workspace/AgentMark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AgentCatalogRow } from "@/components/workspace/AgentCatalogRow";
import { TUI_AGENT_BY_ID, type AgentPermissionMode } from "@/lib/agents/catalog";
import { useAgentStore } from "@/lib/agents/store";
import type { AgentViewMode } from "@/lib/agents/types";
import { useHostAgents } from "@/lib/agents/use-host-agents";
import { cn } from "@/lib/utils";

type Option<T extends string> = { id: T; label: string; icon?: ReactNode; disabled?: boolean };

/** One control shape for every preference: trigger on the right, menu under it. */
function Select<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: T;
  options: Option<T>[];
  ariaLabel: string;
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((item) => item.id === value) ?? options[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="inline-flex h-field min-w-32 max-w-48 shrink-0 items-center justify-between gap-2 rounded-md border border-border px-2.5 text-label text-fg transition-colors hover:border-border-strong hover:bg-elevated"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {current?.icon}
            <span className="truncate">{current?.label}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-subtle" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-72 w-52 overflow-y-auto py-1">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              onChange(item.id);
              setOpen(false);
            }}
            className={cn(
              "flex h-row w-full items-center gap-2 px-3 text-left text-body hover:bg-elevated",
              item.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            {item.icon}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.id === value ? <Check className="size-3.5 shrink-0 text-muted" /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
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
      className="relative isolate grid shrink-0 grid-cols-2 rounded-full bg-chip p-0.5"
      role="group"
      aria-label="权限模式"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 left-0.5 h-micro w-[calc(50%-2px)] rounded-full bg-surface shadow-[var(--shadow-border)] transition-transform duration-[var(--duration-emphasized)] ease-out-strong",
          value === "manual" && "translate-x-full",
        )}
      />
      <button
        type="button"
        aria-pressed={value === "yolo"}
        onClick={() => onChange("yolo")}
        className={cn(
          "relative z-10 h-micro min-w-12 px-2.5 text-meta transition-colors duration-[var(--duration-emphasized)]",
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
          "relative z-10 h-micro min-w-12 px-2.5 text-meta transition-colors duration-[var(--duration-emphasized)]",
          value === "manual" ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        普通
      </button>
    </div>
  );
}

/** Label and hint read as one block on the left; the control always lands on the right. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-body font-medium text-fg">{label}</p>
        <p className="mt-0.5 text-meta leading-4 text-muted">{hint}</p>
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function GroupLabel({ children, count }: { children: ReactNode; count?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-1.5">
      <span className="text-meta font-medium tracking-[0.06em] text-muted">{children}</span>
      {count !== undefined ? <span className="text-meta text-muted">{count}</span> : null}
    </div>
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

  const agentOptions = useMemo(
    () => [
      { id: "auto", label: "自动" },
      { id: "blank", label: "无智能体", icon: <AgentMark id="blank" className="size-3.5" /> },
      ...available.map((item) => ({
        id: item.id,
        label: item.name,
        icon: <AgentMark id={item.id} className="size-3.5" />,
        disabled: disabledSet.has(item.id),
      })),
    ],
    [available, disabledSet],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] w-[min(100%-1.5rem,38rem)] flex-col overflow-hidden p-0">
        <div className="shrink-0 px-5 pt-5">
          <DialogTitle>智能体设置</DialogTitle>
          <DialogDescription>
            刷新会探测本机命令。启用后会出现在新建菜单里。改动即时保存。
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5">
          <section>
            <GroupLabel>全局偏好</GroupLabel>
            <div className="divide-y divide-border rounded-lg border border-border">
              <SettingRow
                label="默认智能体"
                hint="新建按钮启动这一项。自动会选本机已检测且已启用的第一项。"
              >
                <Select
                  ariaLabel="默认智能体"
                  value={defaultAgentId}
                  options={agentOptions}
                  onChange={(next) => setDefaultAgent(next as typeof defaultAgentId)}
                />
              </SettingRow>
              <SettingRow
                label="默认视图"
                hint="支持 Chat UI 的智能体新会话打开哪一侧；标为「仅终端」的智能体和新终端只有终端视图。"
              >
                <Select
                  ariaLabel="默认视图"
                  value={defaultViewMode}
                  options={[
                    { id: "chat" as AgentViewMode, label: "Chat UI" },
                    { id: "terminal" as AgentViewMode, label: "终端" },
                  ]}
                  onChange={setDefaultViewMode}
                />
              </SettingRow>
              <SettingRow
                label="权限模式"
                hint="Yolo 在启动命令里加上跳过确认的参数；普通模式沿用智能体自己的确认流程。"
              >
                <PermissionModeToggle value={permissionMode} onChange={setPermissionMode} />
              </SettingRow>
            </div>
          </section>

          <section className="mt-6 min-w-0">
            <div className="flex items-center gap-2">
              <label className="flex h-field min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-2.5 transition-colors focus-within:border-border-strong hover:border-border-strong">
                <Search className="size-3.5 shrink-0 text-subtle" />
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="筛选 claude / grok / mcode"
                  aria-label="筛选智能体"
                  className="min-w-0 flex-1 bg-transparent text-label text-fg outline-none placeholder:text-subtle"
                />
              </label>
              <button
                type="button"
                onClick={refresh}
                aria-label={probing ? "正在探测本机命令" : "重新探测本机命令"}
                className="inline-flex h-field shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-meta text-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                <RefreshCw className={cn("size-3.5", probing && "animate-spin")} />
                {probing ? "探测中" : "刷新"}
              </button>
            </div>

            {installed.length > 0 ? (
              <div className="mt-5">
                <GroupLabel count={`${installed.length}`}>已安装</GroupLabel>
                <div className="divide-y divide-border border-t border-border">
                  {installed.map((item) => (
                    <AgentCatalogRow
                      key={item.id}
                      item={item}
                      spec={TUI_AGENT_BY_ID[item.id]}
                      permissionMode={permissionMode}
                      enabled={!disabledSet.has(item.id)}
                      isDefault={defaultAgentId === item.id}
                      onSetEnabled={(next) => setAgentEnabled(item.id, next)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-5 rounded-md border border-dashed border-border px-3 py-4 text-center text-label text-muted">
                {probing ? "正在探测本机智能体…" : "没有检测到已安装的智能体。"}
              </p>
            )}

            {installable.length > 0 ? (
              <div className="mt-6">
                <GroupLabel count={`${installable.length}`}>可安装</GroupLabel>
                <div className="divide-y divide-border border-t border-border">
                  {installable.map((item) => (
                    <AgentCatalogRow
                      key={item.id}
                      item={item}
                      spec={TUI_AGENT_BY_ID[item.id]}
                      permissionMode={permissionMode}
                      enabled={!disabledSet.has(item.id)}
                      isDefault={false}
                      onSetEnabled={(next) => setAgentEnabled(item.id, next)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
