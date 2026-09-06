import { useEffect, useMemo, useRef, useState } from "react";
import { AgentMark } from "@/components/workspace/AgentMark";
import { ComposerBar } from "@/components/workspace/ComposerBar";
import type { SuggestItem } from "@/components/workspace/ComposerSuggest";
import { getAgentChatProfile } from "@/lib/agents/chat-profile";
import { TUI_AGENT_BY_ID } from "@/lib/agents/catalog";
import {
  applyComposerInsert,
  detectComposerTrigger,
  filterMentionPaths,
} from "@/lib/agents/composer-trigger";
import { AGENT_STOP_BYTES, ingestChatLines, isComposerReady } from "@/lib/agents/pty";
import { filterSlashCommands } from "@/lib/agents/slash-catalog";
import { useAgentStore } from "@/lib/agents/store";
import type { AgentSession, ChatMessage } from "@/lib/agents/types";
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
import { uid } from "@/lib/utils";

function renderBody(content: string) {
  const parts = content.split(/```/);
  if (parts.length === 1) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <pre
        key={index}
        className="my-2 overflow-x-auto rounded-sm bg-bg px-3 py-2 font-mono text-xs leading-5 text-fg"
      >
        {part.replace(/^[a-zA-Z0-9_-]+\n/, "")}
      </pre>
    ) : (
      <p key={index} className="whitespace-pre-wrap break-words">
        {part}
      </p>
    ),
  );
}

function MessageRow({ message, agentId }: { message: ChatMessage; agentId: AgentSession["agentId"] }) {
  const images = (message.attachments ?? []).filter((item) => item.kind === "image" && item.preview);
  const files = (message.attachments ?? []).filter((item) => item.kind !== "image" || !item.preview);
  if (message.role === "user") {
    return (
      <div className="flex justify-end pl-10">
        <div className="max-w-[min(32rem,100%)] rounded-lg bg-elevated px-3.5 py-2.5 text-sm leading-6 text-fg shadow-[var(--shadow-border)]">
          {images.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {images.map((item) => (
                <img
                  key={item.id}
                  src={item.preview}
                  alt={item.name}
                  className="h-24 max-w-full rounded-sm object-cover"
                />
              ))}
            </div>
          ) : null}
          {files.length ? (
            <ul className="mb-1 text-xs text-muted">
              {files.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          ) : null}
          {message.content && message.content !== "附件" ? renderBody(message.content) : null}
        </div>
      </div>
    );
  }
  if (message.role === "system") {
    return <p className="text-center text-xs text-subtle">{message.content}</p>;
  }
  return (
    <div className="flex gap-2.5 pr-6">
      <AgentMark id={agentId} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 pt-px text-sm leading-6 text-fg">
        {message.pending && !message.content ? (
          <p className="text-muted">正在回复…</p>
        ) : (
          renderBody(message.content)
        )}
        {message.pending && message.content ? (
          <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-accent" />
        ) : null}
      </div>
    </div>
  );
}

export function AgentChat({ session, pty }: { session: AgentSession; pty: HostPty }) {
  const appendMessage = useAgentStore((s) => s.appendMessage);
  const patchMessage = useAgentStore((s) => s.patchMessage);
  const files = useVaultStore((s) => s.files);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [refs, setRefs] = useState<ComposerRef[]>([]);
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [activeSuggest, setActiveSuggest] = useState(0);
  const [suppressSuggest, setSuppressSuggest] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const turnRef = useRef<{ id: string; user: string; quiet: number; acc: string[] } | null>(null);
  const seenRef = useRef(new Set<string>());
  const readyRef = useRef(false);
  const profile = useMemo(() => getAgentChatProfile(session.agentId), [session.agentId]);
  const live = pty.live || session.status === "starting" || session.status === "running";
  const pending = session.messages.some((item) => item.pending);
  const spec = session.agentId === "custom" || session.agentId === "terminal" ? null : TUI_AGENT_BY_ID[session.agentId];
  const label = spec?.name ?? (session.agentId === "terminal" ? "终端" : session.agentId);
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
    endRef.current?.scrollIntoView({ block: "end" });
  }, [session.messages, session.id]);

  useEffect(() => {
    seenRef.current = new Set();
    turnRef.current = null;
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
    return pty.subscribe((chunk) => {
      if (!readyRef.current && isComposerReady(chunk, profile)) {
        readyRef.current = true;
        setReady(true);
      }
      const turn = turnRef.current;
      const fresh = ingestChatLines(chunk, profile, seenRef.current, turn?.user ?? "");
      if (!turn || fresh.length === 0) return;
      if (profile.surface === "tui") turn.acc = [...turn.acc, ...fresh];
      else turn.acc.push(...fresh);
      turn.quiet = Date.now();
      patchMessage(session.id, turn.id, {
        content: turn.acc.join("\n").trim(),
        pending: true,
      });
    });
  }, [pty, patchMessage, session.id, profile]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const turn = turnRef.current;
      if (!turn) return;
      const wait = Date.now() - turn.quiet;
      if (!turn.acc.length && wait < 12000) return;
      if (wait < profile.quietMs) return;
      const content =
        turn.acc.join("\n").trim() ||
        (profile.surface === "tui" ? "可切到终端查看输出。" : "");
      patchMessage(session.id, turn.id, { content, pending: false });
      turnRef.current = null;
    }, 250);
    return () => window.clearInterval(timer);
  }, [patchMessage, session.id, profile.quietMs, profile.surface]);

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
      content: text || (payload.length ? "附件" : "引用"),
      createdAt: Date.now(),
      attachments: payload,
    };
    const assistant: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      pending: true,
    };
    appendMessage(session.id, user);
    appendMessage(session.id, assistant);
    turnRef.current = { id: assistant.id, user: prompt, quiet: Date.now(), acc: [] };
    setDraft("");
    setCursor(0);
    setRefs([]);
    const pendingFiles = attachments.map((item) => ({ relPath: item.relPath, base64: item.base64 }));
    setAttachments([]);
    void (async () => {
      if (pendingFiles.length) {
        await saveHostAttachments({ data: { files: pendingFiles } });
      }
      await pty.writeFollowup(prompt, profile);
    })();
  };

  const stop = () => {
    pty.write(AGENT_STOP_BYTES);
    const turn = turnRef.current;
    if (turn) {
      patchMessage(session.id, turn.id, { pending: false });
      turnRef.current = null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {session.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <AgentMark id={session.agentId} className="size-9" />
            <p className="font-serif text-lg text-fg">{label}</p>
            <p className="max-w-60 text-sm leading-6 text-muted">
              {ready
                ? "直接发消息，也可粘贴截图或拖入文件。"
                : `正在等待 ${label} 就绪…`}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-5 pb-3">
            {session.messages
              .filter((message) => message.role !== "assistant" || message.content || message.pending)
              .map((message) => (
                <MessageRow key={message.id} message={message} agentId={session.agentId} />
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
