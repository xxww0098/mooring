import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { AgentMark } from "@/components/workspace/AgentMark";
import { Input } from "@/components/ui/input";
import type { AgentPermissionMode, TuiAgentSpec } from "@/lib/agents/catalog";
import { formatLaunchLine } from "@/lib/agents/catalog";
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
      className="relative isolate grid shrink-0 grid-cols-2 rounded-full border border-border p-0.5"
      role="group"
      aria-label={`${label} 可用性`}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 left-0.5 h-7 w-[calc(50%-2px)] rounded-full bg-elevated transition-transform duration-200 ease-out",
          !enabled && "translate-x-full",
        )}
      />
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => onChange(true)}
        className={cn(
          "relative z-10 h-7 min-w-12 px-2.5 text-xs transition-colors duration-200",
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
          "relative z-10 h-7 min-w-12 px-2.5 text-xs transition-colors duration-200",
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
  onSetDefault,
}: {
  item: HostAgentProbe;
  spec: TuiAgentSpec;
  permissionMode: AgentPermissionMode;
  enabled: boolean;
  isDefault: boolean;
  onSetEnabled: (enabled: boolean) => void;
  onSetDefault: () => void;
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
    <div className={cn("py-3", !item.available && "opacity-70")}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-elevated/40">
          <AgentMark id={item.id} className="size-4" />
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[12rem]">
          <div className="flex items-center gap-2">
            <span className="text-sm leading-none font-medium text-fg">{item.name}</span>
            {!enabled ? (
              <span className="rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-muted">已禁用</span>
            ) : null}
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted">
            {formatLaunchLine(spec, permissionMode)}
          </p>
        </div>

        <div className="ml-auto grid shrink-0 grid-cols-[max-content_6.5rem_1.75rem_1.75rem] items-center gap-1.5">
          <AvailabilityToggle label={item.name} enabled={enabled} onChange={onSetEnabled} />
          <div className="flex justify-start">
            {item.available && enabled ? (
              <button
                type="button"
                title={isDefault ? "默认智能体" : "设为默认"}
                onClick={onSetDefault}
                className={cn(
                  "inline-flex h-7 w-full items-center justify-center gap-1 rounded-md text-xs",
                  isDefault ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
                )}
              >
                {isDefault ? <Check className="size-3" /> : null}
                {isDefault ? "默认" : "设置默认值"}
              </button>
            ) : null}
          </div>
          <a
            href={homepage}
            target="_blank"
            rel="noopener noreferrer"
            title={item.available ? "文档" : "安装"}
            className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <div className="flex size-7 items-center justify-center">
            {item.available ? (
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? "收起启动参数" : "展开启动参数"}
                onClick={() => setOpen((prev) => !prev)}
                className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
              >
                <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {item.available && open ? (
        <div className="mt-3 space-y-2 pl-10">
          <label className="block space-y-1">
            <span className="text-[11px] text-muted">启动命令</span>
            <Input readOnly value={spec.launchCmd} className="h-8 font-mono text-xs" />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-muted">启动参数</span>
            <Input readOnly value={args} placeholder="无" className="h-8 font-mono text-xs" />
          </label>
          {envSummary ? (
            <label className="block space-y-1">
              <span className="text-[11px] text-muted">环境变量</span>
              <Input readOnly value={envSummary} className="h-8 font-mono text-xs" />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
