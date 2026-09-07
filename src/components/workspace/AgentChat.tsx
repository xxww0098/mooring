import { Check, ChevronDown, Command, Copy, FileText, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { AgentMark } from "@/components/workspace/AgentMark";
import { ComposerBar } from "@/components/workspace/ComposerBar";
import type { SuggestItem } from "@/components/workspace/ComposerSuggest";
import { getAgentChatProfile } from "@/lib/agents/chat-profile";
import { sessionTitle } from "@/lib/agents/catalog";
import {
  applyComposerInsert,
  detectComposerTrigger,
  filterMentionPaths,
} from "@/lib/agents/composer-trigger";
import {
  AGENT_STOP_BYTES,
  appendTranscriptLines,
  isComposerReady,
  parseContextUsage,
  parseThinkingDuration,
} from "@/lib/agents/pty";
import { TranscriptScreen } from "@/lib/agents/screen";
import { filterSlashCommands } from "@/lib/agents/slash-catalog";
import { useAgentStore } from "@/lib/agents/store";
import type {
  AgentSession,
  ChatAttachment,
  ChatMessage,
  ChatReference,
} from "@/lib/agents/types";
import type { HostPty } from "@/lib/agents/use-host-pty";
import { saveHostAttachments } from "@/lib/agents/host";
import {
  buildAttachmentPrompt,
  toChatAttachment,
  type ComposerAttachment,
} from "@/lib/agents/composer-media";
import {
  buildRefPrompt,
  fileLabel,
  makeRef,
  mergeRefs,
  promoteCompletedRefs,
  type ComposerRef,
} from "@/lib/agents/composer-ref";
import { useVaultStore } from "@/lib/vault/store";
import { cn, uid } from "@/lib/utils";

function renderBody(content: string) {
  return <p className="whitespace-pre-wrap break-words">{content}</p>;
}

/** Assistant text arrives token by token, so it is rendered mid-markdown. */
function AssistantBody({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <div className="mooring-prose mooring-stream-in min-w-0">
      <Streamdown
        mode={streaming ? "streaming" : "static"}
        parseIncompleteMarkdown
      >
        {/* Screen rows are one line each; markdown would fold them into one paragraph. */}
        {content.replace(/(?<=\S)\n(?!\n)/g, "  \n")}
      </Streamdown>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-md text-subtle transition-colors hover:bg-chip hover:text-fg"
    >
      {children}
    </button>
  );
}

function MessageActions({
  content,
  align,
  onRetry,
  onWithdraw,
}: {
  content: string;
  align: "start" | "end";
  onRetry?: () => void;
  onWithdraw?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 opacity-0 transition-opacity duration-[var(--duration-base)] group-hover:opacity-100 focus-within:opacity-100",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      <ActionButton label={copied ? "已复制" : "复制"} onClick={copy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </ActionButton>
      {onRetry ? (
        <ActionButton label="重试" onClick={onRetry}>
          <RotateCcw className="size-3.5" />
        </ActionButton>
      ) : null}
      {onWithdraw ? (
        <ActionButton label="撤回并重编" onClick={onWithdraw}>
          <Undo2 className="size-3.5" />
        </ActionButton>
      ) : null}
    </div>
  );
}

/**
 * A reasoning row is re-wrapped as the agent writes, so the same sentence arrives
 * several times at different lengths. Keep the longest version of each, wherever it
 * already sits in the buffer.
 */
function pushThinking(into: string[], line: string) {
  for (let i = 0; i < into.length; i += 1) {
    const existing = into[i];
    if (existing === line || existing.startsWith(line)) return;
    if (line.startsWith(existing)) {
      into[i] = line;
      return;
    }
  }
  into.push(line);
}

function ThinkingGlyph() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden className="size-3.5 shrink-0">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="5.5" cy="7" r="0.75" fill="currentColor" />
      <circle cx="8.5" cy="7" r="0.75" fill="currentColor" />
    </svg>
  );
}

/**
 * Reasoning is an activity card, not prose: collapsed by default, the label sweeps
 * while the agent is still thinking, and a duration plus a one-line preview stand in
 * for the body once it settles. Shape follows Apache Maka's ChatReasoning.
 */
function Reasoning({
  text,
  duration,
  streaming,
}: {
  text: string;
  duration?: string;
  streaming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = text.split("\n").find((line) => line.trim()) ?? "";
  return (
    <div className="mb-2">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setExpanded((prev) => !prev);
        }}
        className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-0.5 text-meta text-muted transition-colors duration-[var(--duration-base)] ease-out-strong hover:text-fg"
      >
        <ThinkingGlyph />
        <span className={cn("shrink-0", streaming && "mooring-shimmer")}>
          {streaming ? "正在思考" : "思考过程"}
        </span>
        {duration && !streaming ? <span className="shrink-0 text-subtle">· {duration}</span> : null}
        {!expanded && preview && !streaming ? (
          <span className="min-w-0 truncate text-subtle">— {preview}</span>
        ) : null}
        <ChevronDown
          className={cn(
            "ml-auto size-3 shrink-0 transition-transform duration-[var(--duration-base)] ease-out-strong",
            expanded && "rotate-180",
          )}
        />
      </div>
      {expanded ? (
        <div className="mooring-disclose mt-1">
          <div className="border-l border-border pl-2.5 text-meta leading-5 whitespace-pre-wrap text-muted">
            {text}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The turn's single motion: the label sweeps while the agent is still working. */
function WorkingLabel({ label }: { label: string }) {
  return (
    <p className="mooring-shimmer text-body" role="status">
      {label}
    </p>
  );
}

/** What this session has been pointed at, kept above the transcript instead of
    repeated inside every bubble. */
function ReferenceBar({ references }: { references: ChatReference[] }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-4 py-1.5">
      <span className="text-meta text-subtle">引用</span>
      <ul className="flex min-w-0 flex-wrap items-center gap-1">
        {references.map((item) => (
          <li
            key={item.id}
            className="inline-flex max-w-56 items-center gap-1 rounded-md bg-chip px-1.5 py-0.5 text-meta text-muted"
          >
            {item.kind === "skill" ? (
              <Command className="size-3 shrink-0" />
            ) : (
              <FileText className="size-3 shrink-0" />
            )}
            <span className="truncate" title={item.value}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageRow({
  message,
  agentId,
  onRetry,
  onWithdraw,
}: {
  message: ChatMessage;
  agentId: AgentSession["agentId"];
  onRetry?: () => void;
  onWithdraw?: () => void;
}) {
  const images = (message.attachments ?? []).filter((item) => item.kind === "image" && item.preview);
  const files = (message.attachments ?? []).filter((item) => item.kind !== "image" || !item.preview);
  if (message.role === "user") {
    return (
      <div className="group flex flex-col items-end gap-1 pl-8">
        <div className="max-w-[min(30rem,100%)] rounded-xl bg-elevated px-3 py-2 text-body text-fg">
          {images.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {images.map((item) => (
                <img
                  key={item.id}
                  src={item.preview}
                  alt={item.name}
                  className="h-20 max-w-full rounded-md object-cover"
                />
              ))}
            </div>
          ) : null}
          {files.length ? (
            <ul className="mb-1 text-meta text-muted">
              {files.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          ) : null}
          {message.content ? renderBody(message.content) : null}
        </div>
        <MessageActions
          content={message.content || (message.references ?? []).map((item) => item.value).join("\n")}
          align="end"
          onWithdraw={onWithdraw}
        />
      </div>
    );
  }
  if (message.role === "system") {
    return <p className="text-center text-meta text-subtle">{message.content}</p>;
  }
  return (
    <div className="group flex gap-2.5 pr-4">
      <AgentMark id={agentId} className="mt-px size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-body text-fg">
        {message.thinking ? (
          <Reasoning
            text={message.thinking}
            duration={message.thinkingDuration}
            streaming={Boolean(message.pending) && !message.content}
          />
        ) : null}
        {message.pending && !message.content ? (
          message.thinking ? null : <WorkingLabel label="正在回复…" />
        ) : (
          <AssistantBody content={message.content} streaming={Boolean(message.pending)} />
        )}
        {message.pending ? null : (
          <MessageActions content={message.content} align="start" onRetry={onRetry} />
        )}
      </div>
    </div>
  );
}

export function AgentChat({ session, pty }: { session: AgentSession; pty: HostPty }) {
  const appendMessage = useAgentStore((s) => s.appendMessage);
  const patchMessage = useAgentStore((s) => s.patchMessage);
  const patchSession = useAgentStore((s) => s.patchSession);
  const removeMessages = useAgentStore((s) => s.removeMessages);
  const files = useVaultStore((s) => s.files);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [refs, setRefs] = useState<ComposerRef[]>([]);
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [activeSuggest, setActiveSuggest] = useState(0);
  const [suppressSuggest, setSuppressSuggest] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  /** Follow the stream only while the user is already at the bottom. */
  const stickRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const turnRef = useRef<{
    id: string;
    user: string;
    quiet: number;
    active: number;
    /** Lines that scrolled out of the viewport: final, append-only. */
    acc: string[];
    /** The block the agent is still repainting: recomputed from the screen each poll. */
    live: string[];
    /** Reasoning rows, shown in their own collapsed block. */
    thinking: string[];
    duration: string | null;
  } | null>(null);
  const seenRef = useRef(new Set<string>());
  const screenRef = useRef<TranscriptScreen | null>(null);
  const contextRef = useRef<{ used: number; limit: number } | null>(null);
  const baselineRef = useRef<Set<string>>(new Set());
  const readyRef = useRef(false);
  const profile = useMemo(() => getAgentChatProfile(session.agentId), [session.agentId]);
  const live = pty.live || session.status === "starting" || session.status === "running";
  const pending = session.messages.some((item) => item.pending);
  const label = sessionTitle(session.agentId);
  const canSend = live && ready && !pending;
  const trigger = suppressSuggest ? null : detectComposerTrigger(draft, cursor);
  const suggestItems = useMemo<SuggestItem[]>(() => {
    if (!trigger) return [];
    if (trigger.kind === "slash") {
      return filterSlashCommands(session.agentId, trigger.query).map((item) => ({
        id: item.name,
        title: `/${item.name}`,
        description: item.description,
        insert: item.args ? `/${item.name} ` : `/${item.name}`,
        kind: "slash" as const,
      }));
    }
    return filterMentionPaths(Object.keys(files), trigger.query).map((path) => ({
      id: `file:${path}`,
      title: path,
      description: "笔记",
      insert: path,
      kind: "mention" as const,
    }));
  }, [trigger, session.agentId, files]);

  useEffect(() => {
    setActiveSuggest(0);
    setSuppressSuggest(false);
  }, [draft]);

  useEffect(() => {
    if (stickRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [session.messages, session.id]);

  useEffect(() => {
    seenRef.current = new Set();
    turnRef.current = null;
    stickRef.current = true;
    readyRef.current = false;
    setReady(false);
    setAttachments([]);
    setRefs([]);
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started >= profile.readyTimeoutMs) {
        readyRef.current = true;
        setReady(true);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [session.id, profile.readyTimeoutMs]);

  useEffect(() => {
    const screen = new TranscriptScreen();
    screenRef.current = screen;
    const initial = pty.size();
    screen.resize(initial.cols, initial.rows);
    void screen.init();
    const stop = pty.onResize((next) => screen.resize(next.cols, next.rows));
    return () => {
      stop();
      screen.dispose();
      screenRef.current = null;
    };
  }, [session.id, pty]);

  useEffect(() => {
    return pty.subscribe((chunk) => {
      if (!readyRef.current && isComposerReady(chunk, profile)) {
        readyRef.current = true;
        setReady(true);
      }
      const screen = screenRef.current;
      if (!screen) return;
      const active = turnRef.current;
      // Any repaint means the agent is still working, even while nothing is printed yet.
      if (active) active.active = Date.now();
      void screen.write(chunk).then((rows) => {
        const usage = parseContextUsage(screen.viewportLines());
        if (usage && (usage.used !== contextRef.current?.used || usage.limit !== contextRef.current?.limit)) {
          contextRef.current = usage;
          patchSession(session.id, { context: usage });
        }
        const turn = turnRef.current;
        if (!turn) return;
        const cols = pty.size().cols;
        appendTranscriptLines(rows, profile, seenRef.current, turn.user, turn.acc, cols, turn.thinking);
        // A full-screen TUI repaints and re-wraps in place, so committing rows as they
        // appear would freeze half-drawn text. Recompute the visible block every poll and
        // let it settle; only what scrolls away is final.
        const live: string[] = [];
        const liveThinking: string[] = [];
        const viewport = screen.viewportLines();
        appendTranscriptLines(
          viewport,
          profile,
          new Set(baselineRef.current),
          turn.user,
          live,
          cols,
          liveThinking,
        );
        turn.duration = turn.duration ?? parseThinkingDuration(viewport);
        for (const line of liveThinking) pushThinking(turn.thinking, line);
        const fresh = live.filter((line) => !seenRef.current.has(line));
        const next = [...turn.acc, ...fresh].join("\n").trim();
        if (next === [...turn.acc, ...turn.live].join("\n").trim()) return;
        turn.live = fresh;
        turn.quiet = Date.now();
        patchMessage(session.id, turn.id, {
          content: next,
          pending: true,
          thinking: turn.thinking.join("\n"),
          thinkingDuration: turn.duration ?? undefined,
        });
      });
    });
  }, [pty, patchMessage, patchSession, session.id, profile]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const turn = turnRef.current;
      if (!turn) return;
      // A turn is over only once the pty itself goes quiet: a TUI that pauses mid-answer
      // is still repainting, and closing there would freeze a half-written reply.
      const idle = Date.now() - turn.active;
      if (idle < 1500) return;
      if (turn.acc.length || turn.live.length) {
        if (Date.now() - turn.quiet < profile.quietMs) return;
      } else if (idle < 20000) {
        return;
      }
      // Poll boundaries can land mid-repaint; the screen is settled by the time a turn
      // closes, so read the block once more rather than keeping a torn frame.
      const settled: string[] = [];
      const settledThinking: string[] = [];
      appendTranscriptLines(
        screenRef.current?.viewportLines() ?? [],
        profile,
        new Set(baselineRef.current),
        turn.user,
        settled,
        pty.size().cols,
        settledThinking,
      );
      for (const line of settledThinking) pushThinking(turn.thinking, line);
      // Only drop what this turn already committed from scrollback; the settled screen is
      // the authority for everything still visible.
      const committed = new Set(turn.acc);
      const tail = settled.filter((line) => !committed.has(line));
      const live = tail.length ? tail : turn.live;
      const content =
        [...turn.acc, ...live].join("\n").trim() ||
        (profile.surface === "tui" ? "可切到终端查看输出。" : "");
      for (const line of live) seenRef.current.add(line);
      patchMessage(session.id, turn.id, {
        content,
        pending: false,
        thinking: turn.thinking.join("\n"),
        thinkingDuration: turn.duration ?? undefined,
      });
      turnRef.current = null;
    }, 250);
    return () => window.clearInterval(timer);
  }, [patchMessage, session.id, profile, pty]);

  const syncCursor = () => {
    const node = inputRef.current;
    if (node) setCursor(node.selectionStart ?? 0);
  };

  const chooseSuggest = (item: SuggestItem) => {
    if (!trigger) return;
    if (item.kind === "mention") {
      const ref = makeRef("file", item.insert, fileLabel(item.insert));
      setRefs((current) => mergeRefs(current, [ref]));
      const next = applyComposerInsert(draft, trigger, "");
      setDraft(next.text);
      setCursor(next.cursor);
      setSuppressSuggest(true);
      requestAnimationFrame(() => {
        const node = inputRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(next.cursor, next.cursor);
      });
      return;
    }
    const next = applyComposerInsert(draft, trigger, item.insert);
    setDraft(next.text);
    setCursor(next.cursor);
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const send = () => {
    const promoted = promoteCompletedRefs(draft, Object.keys(files), [], false);
    const nextRefs = mergeRefs(refs, promoted.refs);
    const text = promoted.text.trim();
    if ((!text && attachments.length === 0 && nextRefs.length === 0) || !canSend) return;
    const payload = attachments.map(toChatAttachment);
    const prompt = buildAttachmentPrompt(buildRefPrompt(text, nextRefs), payload);
    const user: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: text,
      createdAt: Date.now(),
      attachments: payload,
      references: nextRefs.map(({ id, kind, label, value }) => ({ id, kind, label, value })),
    };
    const assistant: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      pending: true,
    };
    setDraft("");
    setCursor(0);
    setRefs([]);
    const pendingFiles = attachments.map((item) => ({ relPath: item.relPath, base64: item.base64 }));
    setAttachments([]);
    submit(user, assistant, prompt, pendingFiles);
  };

  const submit = (
    user: ChatMessage,
    assistant: ChatMessage,
    prompt: string,
    pendingFiles: { relPath: string; base64: string }[],
  ) => {
    stickRef.current = true;
    appendMessage(session.id, user);
    appendMessage(session.id, assistant);
    // Whatever is already on screen (splash, previous answer, status bar) is not this
    // turn's output: mark it seen so it can never open or close the turn.
    const screen = screenRef.current;
    const baseline = new Set<string>();
    if (screen) {
      appendTranscriptLines(screen.viewportLines(), profile, baseline, "", [], pty.size().cols);
    }
    baselineRef.current = baseline;
    turnRef.current = {
      id: assistant.id,
      user: prompt,
      quiet: Date.now(),
      active: Date.now(),
      acc: [],
      live: [],
      thinking: [],
      duration: null,
    };
    void (async () => {
      if (pendingFiles.length) {
        await saveHostAttachments({ data: { files: pendingFiles } });
      }
      await pty.writeFollowup(prompt, profile);
    })();
  };

  /** The user message that produced a given assistant reply. */
  const askedBefore = (assistantId: string): ChatMessage | null => {
    const index = session.messages.findIndex((item) => item.id === assistantId);
    for (let i = index - 1; i >= 0; i -= 1) {
      if (session.messages[i].role === "user") return session.messages[i];
    }
    return null;
  };

  const retry = (assistantId: string) => {
    const asked = askedBefore(assistantId);
    if (!asked || !canSend) return;
    const payload: ChatAttachment[] = asked.attachments ?? [];
    const refs = (asked.references ?? []).map((item) => ({ ...item }));
    submit(
      { ...asked, id: uid("msg"), createdAt: Date.now() },
      { id: uid("msg"), role: "assistant", content: "", createdAt: Date.now(), pending: true },
      buildAttachmentPrompt(buildRefPrompt(asked.content, refs), payload),
      [],
    );
  };

  /** Pull a turn back out of the transcript and into the composer to edit and resend. */
  const withdraw = (userId: string) => {
    const index = session.messages.findIndex((item) => item.id === userId);
    if (index < 0) return;
    const asked = session.messages[index];
    const reply = session.messages[index + 1];
    const drop = [userId];
    if (reply?.role === "assistant") {
      drop.push(reply.id);
      if (reply.pending) stop();
    }
    removeMessages(session.id, drop);
    setDraft(asked.content);
    setCursor(asked.content.length);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const stop = () => {
    pty.write(AGENT_STOP_BYTES);
    const turn = turnRef.current;
    if (turn) {
      patchMessage(session.id, turn.id, { pending: false });
      turnRef.current = null;
    }
  };

  const sessionRefs = useMemo(() => {
    const seenValues = new Set<string>();
    const list: ChatReference[] = [];
    for (const message of session.messages) {
      for (const item of message.references ?? []) {
        const key = `${item.kind}:${item.value}`;
        if (seenValues.has(key)) continue;
        seenValues.add(key);
        list.push(item);
      }
    }
    return list;
  }, [session.messages]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {sessionRefs.length ? <ReferenceBar references={sessionRefs} /> : null}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => {
          const el = event.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        {session.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <AgentMark id={session.agentId} className="size-8" />
            <p className="font-serif text-title text-fg">{label}</p>
            <p className="max-w-56 text-label leading-5 text-muted">
              {ready
                ? "直接发消息，也可粘贴截图或拖入文件。"
                : `正在等待 ${label} 就绪…`}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-4 pb-2">
            {session.messages
              .filter((message) => message.role !== "assistant" || message.content || message.pending)
              .map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  agentId={session.agentId}
                  onRetry={message.role === "assistant" ? () => retry(message.id) : undefined}
                  onWithdraw={message.role === "user" ? () => withdraw(message.id) : undefined}
                />
              ))}
            <div ref={endRef} className="h-2" />
          </div>
        )}
      </div>
      <ComposerBar
        session={session}
        pty={pty}
        profile={profile}
        draft={draft}
        setDraft={(value) => {
          const promoted = promoteCompletedRefs(value, Object.keys(files), [], true);
          if (promoted.refs.length) {
            setRefs((current) => mergeRefs(current, promoted.refs));
            setDraft(promoted.text);
            return;
          }
          setDraft(value);
        }}
        setCursor={setCursor}
        inputRef={inputRef}
        suggestItems={suggestItems}
        activeSuggest={activeSuggest}
        setActiveSuggest={setActiveSuggest}
        chooseSuggest={chooseSuggest}
        live={live}
        ready={ready}
        pending={pending}
        onSend={send}
        onStop={stop}
        onSyncCursor={syncCursor}
        attachments={attachments}
        onAttachments={setAttachments}
        refs={refs}
        onRefs={setRefs}
        onKeyDown={(event) => {
          if (suggestItems.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveSuggest((i) => (i + 1) % suggestItems.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveSuggest((i) => (i - 1 + suggestItems.length) % suggestItems.length);
              return;
            }
            if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
              event.preventDefault();
              const item = suggestItems[activeSuggest] ?? suggestItems[0];
              if (item) chooseSuggest(item);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setSuppressSuggest(true);
              return;
            }
          }
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (pending) stop();
            else send();
          }
        }}
      />
    </div>
  );
}
