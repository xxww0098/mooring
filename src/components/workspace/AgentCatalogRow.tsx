import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { AgentMark } from "@/components/workspace/AgentMark";
import { Input } from "@/components/ui/input";
import type { AgentPermissionMode, TuiAgentSpec } from "@/lib/agents/catalog";
import { formatLaunchLine } from "@/lib/agents/catalog";
import { supportsChatUi } from "@/lib/agents/chat-profile";
import { AGENT_HOMEPAGE_URLS } from "@/lib/agents/icon-assets";
import type { HostAgentProbe } from "@/lib/agents/types";
import { cn } from "@/lib/utils";

function AvailabilityToggle({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div
      className="relative isolate grid shrink-0 grid-cols-2 rounded-full bg-chip p-0.5"
      role="group"
      aria-label={`${label} 可用性`}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 left-0.5 h-micro w-[calc(50%-2px)] rounded-full bg-surface shadow-[var(--shadow-border)] transition-transform duration-[var(--duration-emphasized)] ease-out-strong",
          !enabled && "translate-x-full",
        )}
      />
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => onChange(true)}
        className={cn(
          "relative z-10 h-micro min-w-12 px-2 text-meta transition-colors duration-[var(--duration-emphasized)]",
          enabled ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        启用
      </button>
      <button
        type="button"
        aria-pressed={!enabled}
        onClick={() => onChange(false)}
        className={cn(
          "relative z-10 h-micro min-w-12 px-2 text-meta transition-colors duration-[var(--duration-emphasized)]",
          !enabled ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        已禁用
      </button>
    </div>
  );
}

export function AgentCatalogRow({
  item,
  spec,
  permissionMode,
  enabled,
  isDefault,
  onSetEnabled,
}: {
  item: HostAgentProbe;
  spec: TuiAgentSpec;
  permissionMode: AgentPermissionMode;
  enabled: boolean;
  isDefault: boolean;
  onSetEnabled: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const homepage = AGENT_HOMEPAGE_URLS[item.id];
  const args = permissionMode === "manual" ? "" : spec.yoloArgs.trim();
  const envSummary =
    permissionMode === "manual"
      ? ""
      : Object.entries(spec.yoloEnv ?? {})
          .map(([key, value]) => `${key}=${value}`)
          .join(" ");

  return (
    <div className={cn("py-2", !item.available && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-elevated/40">
          <AgentMark id={item.id} className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[12rem]">
          <div className="flex items-center gap-1.5">
            <span className="text-body leading-none font-medium text-fg">{item.name}</span>
            {isDefault ? (
              <span className="rounded-full border border-border px-1.5 text-meta leading-4 text-muted">默认</span>
            ) : null}
            {supportsChatUi(item.id) ? null : (
              <span className="rounded-full border border-border px-1.5 text-meta leading-4 text-muted">仅终端</span>
            )}
          </div>
          <p className="mt-0.5 truncate font-mono text-meta text-muted">
            {formatLaunchLine(spec, permissionMode)}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <AvailabilityToggle label={item.name} enabled={enabled} onChange={onSetEnabled} />
          <a
            href={homepage}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.available ? "文档" : "安装"}
            className="flex size-6 items-center justify-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
          >
            <ExternalLink className="size-3" />
          </a>
          <div className="flex size-6 items-center justify-center">
            {item.available ? (
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? "收起启动参数" : "展开启动参数"}
                onClick={() => setOpen((prev) => !prev)}
                className="flex size-6 items-center justify-center rounded-md text-subtle hover:bg-elevated hover:text-fg"
              >
                <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {item.available && open ? (
        <div className="mooring-disclose mt-2.5">
          <div className="space-y-2 pl-9">
          <label className="block space-y-1">
            <span className="text-meta text-muted">启动命令</span>
            <Input readOnly value={spec.launchCmd} className="h-row font-mono text-meta" />
          </label>
          <label className="block space-y-1">
            <span className="text-meta text-muted">启动参数</span>
            <Input readOnly value={args} placeholder="无" className="h-row font-mono text-meta" />
          </label>
          {envSummary ? (
            <label className="block space-y-1">
              <span className="text-meta text-muted">环境变量</span>
              <Input readOnly value={envSummary} className="h-row font-mono text-meta" />
            </label>
          ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
