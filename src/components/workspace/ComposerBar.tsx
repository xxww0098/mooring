import {
  ArrowUp,
  AtSign,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  FileText,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComposerSuggest, type SuggestItem } from "@/components/workspace/ComposerSuggest";
import {
  ACCESS_OPTIONS,
  accessCommand,
  composerFamilies,
  defaultAccess,
  formatModelChip,
  modelCommand,
  resolveEffort,
  resolveFamily,
  thinkingCommand,
  type ComposerModelFamily,
} from "@/lib/agents/composer-controls";
import type { AgentChatProfile } from "@/lib/agents/chat-profile";
import type { LaunchableAgentId } from "@/lib/agents/catalog";
import {
  clipboardToFiles,
  filesToAttachments,
  mergeAttachments,
  type ComposerAttachment,
} from "@/lib/agents/composer-media";
import { useAgentStore } from "@/lib/agents/store";
import { loadHostModelCatalogs } from "@/lib/agents/host";
import type { AccessMode, AgentSession, ThinkingLevel } from "@/lib/agents/types";
import type { ComposerRef } from "@/lib/agents/composer-ref";
import type { HostPty } from "@/lib/agents/use-host-pty";
import { cn } from "@/lib/utils";

const SHIELD_OUTLINE =
  "M8.20554 0.899994L14.7901 3.36857V7.01026C14.7901 12 11.0466 14.2103 8.20554 15.3C5.36446 14.2103 1.62012 12 1.62012 7.01026V3.36857L8.20554 0.899994Z";

function PermissionGlyph({ mode, className }: { mode: AccessMode; className?: string }) {
  if (mode === "read") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
        <path d={SHIELD_OUTLINE} stroke="currentColor" strokeWidth="1.32" strokeLinejoin="round" />
        <path
          d="M12.165 5.755L8.945 9.415C8.73 9.658 8.536 9.88 8.358 10.042C8.171 10.211 7.942 10.372 7.64 10.425C7.482 10.454 7.32 10.455 7.162 10.429C6.858 10.38 6.627 10.222 6.438 10.056C6.258 9.897 6.06 9.677 5.843 9.437L4.729 8.209L5.636 7.387L6.749 8.616C6.986 8.878 7.13 9.035 7.247 9.138C7.31 9.194 7.345 9.215 7.358 9.221C7.381 9.225 7.404 9.225 7.426 9.221C7.429 9.233 7.536 9.136 7.536 9.136C7.651 9.031 7.793 8.871 8.026 8.606L11.248 4.948L12.165 5.755Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (mode === "workspace") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
        <path d={SHIELD_OUTLINE} stroke="currentColor" strokeWidth="1.32" strokeLinejoin="round" />
        <path d="M5.1 9.85L9.55 5.4L10.7 6.55L6.25 11H5.1V9.85Z" fill="currentColor" />
        <path d="M10.05 4.9L10.7 4.25C10.9 4.05 11.22 4.05 11.42 4.25L11.85 4.68C12.05 4.88 12.05 5.2 11.85 5.4L11.2 6.05L10.05 4.9Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d={SHIELD_OUTLINE} stroke="currentColor" strokeWidth="1.32" strokeLinejoin="round" />
      <path d="M9.101 4.5V8.76H7.599V4.5H9.101Z" fill="currentColor" />
      <path d="M9.101 9.811V11.5H7.599V9.811H9.101Z" fill="currentColor" />
    </svg>
  );
}

const RING_R = 5.6;
const RING_C = 2 * Math.PI * RING_R;

function formatTokens(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}K`;
  return String(Math.round(value));
}

function ContextRing({
  context,
  estimate,
}: {
  context?: { used: number; limit: number };
  estimate: number;
}) {
  const pct = context ? Math.min(100, Math.round((context.used / context.limit) * 100)) : null;
  const title = context
    ? context.limit === 100
      ? `上下文已用 ${pct}%`
      : `上下文 ${pct}% · ${formatTokens(context.used)} / ${formatTokens(context.limit)}`
    : `已发送约 ${formatTokens(estimate)} tokens · 智能体未上报上下文`;
  return (
    <span
      role="img"
      aria-label={title}
      className={cn(
        "grid size-row shrink-0 place-items-center",
        pct !== null && pct >= 90 ? "text-danger" : pct !== null && pct >= 70 ? "text-fg" : "text-muted",
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-4">
        <circle cx="8" cy="8" r={RING_R} stroke="currentColor" strokeWidth="1.4" opacity="0.28" />
        {pct !== null ? (
          <circle
            cx="8"
            cy="8"
            r={RING_R}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray={`${(RING_C * pct) / 100} ${RING_C}`}
            transform="rotate(-90 8 8)"
          />
        ) : null}
      </svg>
    </span>
  );
}

function ChipSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  align = "start",
  disabled,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
  icon?: ReactNode;
  align?: "start" | "end";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((item) => item.id === value) ?? options[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className="inline-flex h-row max-w-[14rem] items-center gap-1 rounded-full px-2 text-meta font-medium text-muted hover:bg-chip hover:text-fg disabled:opacity-40"
          onMouseDown={(event) => event.preventDefault()}
        >
          {icon ? <span className="inline-flex size-3.5 shrink-0 items-center justify-center">{icon}</span> : null}
          <span className="truncate">{current?.label}</span>
          <ChevronDown className="size-3 shrink-0 text-subtle" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} side="top" className="w-52 overflow-hidden py-1">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            className="flex h-field w-full items-center justify-between gap-2 px-3 text-left text-body hover:bg-elevated"
            onClick={() => {
              onChange(item.id);
              setOpen(false);
            }}
          >
            <span>{item.label}</span>
            {item.id === value ? <Check className="size-3.5 text-muted" /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function MenuRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-field w-full items-center justify-between gap-3 px-3 text-left text-body hover:bg-elevated"
      onClick={onClick}
    >
      <span className="text-muted">{label}</span>
      <span className="inline-flex min-w-0 items-center gap-1 text-fg">
        <span className="truncate">{value}</span>
        <ChevronRight className="size-3.5 shrink-0 text-subtle" />
      </span>
    </button>
  );
}

function ModelEffortPicker({
  families,
  modelId,
  effort,
  disabled,
  context,
  estimate,
  onModel,
  onEffort,
}: {
  families: ComposerModelFamily[];
  modelId: string;
  effort: ThinkingLevel;
  disabled?: boolean;
  context?: { used: number; limit: number };
  estimate: number;
  onModel: (id: string) => void;
  onEffort: (id: ThinkingLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"root" | "model" | "effort">("root");
  const family = resolveFamily(families, modelId);
  if (!family) return null;
  const effortLabel = family.efforts.find((item) => item.id === effort)?.label;
  const chip = formatModelChip(family, effort);
  const hasEffort = family.efforts.length > 0;

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) setPanel("root");
  };

  return (
    <Popover open={open} onOpenChange={close}>
      <div className="flex items-center gap-2">
        <PopoverAnchor asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="模型"
            className="inline-flex h-row max-w-[15rem] items-center gap-1 rounded-full bg-chip px-2.5 text-meta font-medium text-fg hover:bg-paper disabled:opacity-40"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setPanel("root");
              setOpen(true);
            }}
          >
            <span className="truncate">{chip}</span>
            <ChevronDown className="size-3 shrink-0 text-subtle" />
          </button>
        </PopoverAnchor>
        <ContextRing context={context} estimate={estimate} />
      </div>
      <PopoverContent align="end" side="top" className="w-64 overflow-hidden py-1">
        {panel === "root" ? (
          <>
            <MenuRow label="模型" value={family.label} onClick={() => setPanel("model")} />
            {hasEffort ? (
              <MenuRow label="推理等级" value={effortLabel ?? family.defaultEffort} onClick={() => setPanel("effort")} />
            ) : null}
          </>
        ) : null}
        {panel === "model" ? (
          <>
            <button
              type="button"
              className="flex h-field w-full items-center gap-1.5 px-3 text-label text-muted hover:bg-elevated hover:text-fg"
              onClick={() => setPanel("root")}
            >
              <ChevronLeft className="size-3.5" />
              模型
            </button>
            {families.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onModel(item.id);
                  setPanel("root");
                }}
                className="flex h-field w-full items-center justify-between gap-2 px-3 text-left text-body hover:bg-elevated"
              >
                <span>{item.label}</span>
                {item.id === family.id ? <Check className="size-3.5 text-muted" /> : null}
              </button>
            ))}
          </>
        ) : null}
        {panel === "effort" ? (
          <>
            <button
              type="button"
              className="flex h-field w-full items-center gap-1.5 px-3 text-label text-muted hover:bg-elevated hover:text-fg"
              onClick={() => setPanel("root")}
            >
              <ChevronLeft className="size-3.5" />
              推理等级
            </button>
            {family.efforts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onEffort(item.id);
                  setPanel("root");
                }}
                className="flex h-field w-full items-center justify-between gap-2 px-3 text-left text-body hover:bg-elevated"
              >
                <span>{item.label}</span>
                {item.id === effort ? <Check className="size-3.5 text-muted" /> : null}
              </button>
            ))}
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function ComposerBar({
  session,
  pty,
  profile,
  draft,
  setDraft,
  setCursor,
  inputRef,
  suggestItems,
  activeSuggest,
  setActiveSuggest,
  chooseSuggest,
  live,
  ready,
  pending,
  onSend,
  onStop,
  onKeyDown,
  onSyncCursor,
  attachments,
  onAttachments,
  refs,
  onRefs,
}: {
  session: AgentSession;
  pty: HostPty;
  profile: AgentChatProfile;
  draft: string;
  setDraft: (value: string) => void;
  setCursor: (value: number) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  suggestItems: SuggestItem[];
  activeSuggest: number;
  setActiveSuggest: (value: number) => void;
  chooseSuggest: (item: SuggestItem) => void;
  live: boolean;
  ready: boolean;
  pending: boolean;
  onSend: () => void;
  onStop: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSyncCursor: () => void;
  attachments: ComposerAttachment[];
  onAttachments: (next: ComposerAttachment[]) => void;
  refs: ComposerRef[];
  onRefs: (next: ComposerRef[]) => void;
}) {
  const permissionMode = useAgentStore((s) => s.permissionMode);
  const patchSession = useAgentStore((s) => s.patchSession);
  const modelCatalogs = useAgentStore((s) => s.modelCatalogs);
  const setModelCatalogs = useAgentStore((s) => s.setModelCatalogs);
  const fileRef = useRef<HTMLInputElement>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const agentId = session.agentId as LaunchableAgentId;
  const families = useMemo(
    () => composerFamilies(agentId, modelCatalogs[agentId]),
    [agentId, modelCatalogs],
  );

  // Keyed on the agent only: the host never returns a catalog for some agents, and
  // re-running on every store write would refetch (and re-spawn `grok models`) forever.
  useEffect(() => {
    if (useAgentStore.getState().modelCatalogs[agentId]?.length) return;
    void loadHostModelCatalogs()
      .then((result) => {
        if (result.catalogs) setModelCatalogs(result.catalogs);
      })
      .catch(() => {});
  }, [agentId, setModelCatalogs]);
  // Fallback only: what we sent, not what the agent's context actually holds.
  const estimatedTokens = useMemo(
    () => Math.round(session.messages.reduce((sum, item) => sum + item.content.length, 0) / 3.5),
    [session.messages],
  );
  const family = resolveFamily(families, session.modelId);
  const modelId = family?.id ?? "";
  const thinking = family ? resolveEffort(family, session.thinking) : "high";
  const access = session.accessMode ?? defaultAccess(permissionMode === "yolo");
  const ended = !live;
  const empty = !draft.trim() && attachments.length === 0 && refs.length === 0;
  const sendDisabled = pending ? false : ended || !ready || empty;

  useLayoutEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.max(52, Math.min(node.scrollHeight, 336))}px`;
  }, [draft, inputRef]);

  const applyCommand = (line: string | null) => {
    if (!line || !ready || !live) return;
    void pty.writeFollowup(line, profile);
  };

  const insertDraft = (token: string) => {
    const node = inputRef.current;
    const start = node?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, start)}${token}${draft.slice(start)}`;
    setDraft(next);
    const cursor = start + token.length;
    setCursor(cursor);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  const addFiles = async (files: Iterable<File>) => {
    const incoming = await filesToAttachments(files);
    if (!incoming.length) return;
    const merged = mergeAttachments(attachments, incoming);
    onAttachments(merged.next);
    setAttachError(merged.error);
  };

  return (
    <div className="shrink-0 px-3 pb-2">
      <div className="mx-auto w-full max-w-2xl">
        <ComposerSuggest
          items={suggestItems}
          active={activeSuggest}
          onActive={setActiveSuggest}
          onChoose={chooseSuggest}
        />
        {refs.length > 0 || attachments.length > 0 ? (
          <div className="mb-2 flex flex-col gap-1.5 px-1">
            {refs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {refs.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex h-micro max-w-[14rem] items-center gap-1 rounded-full bg-chip pl-2 pr-0.5 text-meta text-fg"
                  >
                    {item.kind === "skill" ? (
                      <Sparkles className="size-3 shrink-0 text-accent" />
                    ) : (
                      <FileText className="size-3 shrink-0 text-muted" />
                    )}
                    <span className="truncate">{item.label}</span>
                    <button
                      type="button"
                      aria-label={`移除 ${item.label}`}
                      className="grid size-5 place-items-center rounded-full text-muted hover:text-fg"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onRefs(refs.filter((row) => row.id !== item.id))}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((item) => (
                  <div
                    key={item.id}
                    className="relative flex h-8 max-w-[11rem] items-center gap-1.5 overflow-hidden rounded-full bg-chip pr-6"
                  >
                    {item.kind === "image" && item.preview ? (
                      <img src={item.preview} alt="" className="h-8 w-8 object-cover" />
                    ) : (
                      <span className="grid h-8 w-7 place-items-center text-muted">
                        <FileText className="size-3.5" />
                      </span>
                    )}
                    <span className="min-w-0 pr-1">
                      <span className="block truncate text-meta text-fg">{item.name}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`移除 ${item.name}`}
                      className="absolute top-1 right-0.5 grid size-5 place-items-center rounded-full text-muted hover:text-fg"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onAttachments(attachments.filter((row) => row.id !== item.id))}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {attachError ? <p className="text-meta text-danger">{attachError}</p> : null}
          </div>
        ) : null}
        <div
          className={cn(
            "relative flex flex-col gap-2 rounded-composer bg-elevated pt-2 shadow-[var(--shadow-border)]",
            dragging && "ring-2 ring-accent",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            if (ended) return;
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!ended) void addFiles(event.dataTransfer.files);
          }}
        >
          {dragging ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-composer bg-elevated/80 text-label text-muted">
              放到这里，发给智能体
            </div>
          ) : null}
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setCursor(event.target.selectionStart ?? 0);
            }}
            onSelect={onSyncCursor}
            onClick={onSyncCursor}
            onKeyUp={onSyncCursor}
            onKeyDown={onKeyDown}
            onPaste={(event) => {
              const files = clipboardToFiles(event.clipboardData);
              if (!files.length) return;
              event.preventDefault();
              void addFiles(files);
            }}
            rows={1}
            placeholder={!live ? "会话已结束" : "发消息、粘贴截图，或把文件拖进来"}
            disabled={ended}
            aria-label="对话输入"
            className="max-h-40 min-h-[32px] w-full resize-none overflow-y-auto bg-transparent px-3 pt-1 pr-2 text-label leading-5 text-fg caret-send outline-none placeholder:text-subtle disabled:text-subtle"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <Popover open={plusOpen} onOpenChange={setPlusOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={ended}
                    aria-label="添加"
                    className="grid size-add place-items-center rounded-full border border-border bg-surface text-muted shadow-[var(--shadow-border)] transition-colors hover:border-border-strong hover:text-fg disabled:opacity-40"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" side="top" className="w-44 overflow-hidden py-1">
                  <button
                    type="button"
                    className="flex h-field w-full items-center gap-2 px-3 text-left text-body hover:bg-elevated"
                    onClick={() => {
                      insertDraft("/");
                      setPlusOpen(false);
                    }}
                  >
                    <Command className="size-3.5 text-muted" />
                    调用指令
                  </button>
                  <button
                    type="button"
                    className="flex h-field w-full items-center gap-2 px-3 text-left text-body hover:bg-elevated"
                    onClick={() => {
                      insertDraft("@");
                      setPlusOpen(false);
                    }}
                  >
                    <AtSign className="size-3.5 text-muted" />
                    引用笔记
                  </button>
                  <button
                    type="button"
                    className="flex h-field w-full items-center gap-2 px-3 text-left text-body hover:bg-elevated"
                    onClick={() => {
                      setPlusOpen(false);
                      fileRef.current?.click();
                    }}
                  >
                    <Paperclip className="size-3.5 text-muted" />
                    附加文件
                  </button>
                </PopoverContent>
              </Popover>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf,.md,.txt,.json,.csv,.ts,.tsx,.js,.py"
                className="hidden"
                onChange={(event) => {
                  const list = event.target.files;
                  event.target.value = "";
                  if (list?.length) void addFiles(list);
                }}
              />
              <ChipSelect
                ariaLabel="权限"
                value={access}
                options={ACCESS_OPTIONS}
                disabled={ended}
                icon={<PermissionGlyph mode={access} className="size-3.5" />}
                onChange={(next: AccessMode) => {
                  patchSession(session.id, { accessMode: next });
                  applyCommand(accessCommand(agentId, next));
                }}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {family ? (
                <ModelEffortPicker
                  families={families}
                  modelId={modelId}
                  effort={thinking}
                  disabled={ended}
                  context={session.context}
                  estimate={estimatedTokens}
                  onModel={(next) => {
                    const picked = resolveFamily(families, next);
                    if (!picked) return;
                    const nextEffort = resolveEffort(picked, thinking);
                    patchSession(session.id, { modelId: picked.id, thinking: nextEffort });
                    applyCommand(modelCommand(picked.id));
                    if (nextEffort !== thinking) applyCommand(thinkingCommand(agentId, nextEffort));
                  }}
                  onEffort={(next) => {
                    patchSession(session.id, { thinking: next });
                    applyCommand(thinkingCommand(agentId, next));
                  }}
                />
              ) : null}
              <button
                type="button"
                disabled={sendDisabled}
                aria-label={pending ? "停止" : "发送"}
                onClick={() => (pending ? onStop() : onSend())}
                className={cn(
                  "grid size-send place-items-center rounded-full text-send-fg transition-opacity",
                  pending ? "bg-danger" : "bg-send hover:bg-send-hover",
                  sendDisabled && "opacity-40",
                )}
                onMouseDown={(event) => event.preventDefault()}
              >
                {pending ? <Square className="size-2 fill-current" /> : <ArrowUp className="size-3.5 translate-y-[0.5px]" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
