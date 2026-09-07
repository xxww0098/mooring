import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentChatProfile } from "./chat-profile";
import { pollHostAgent, resizeHostAgent, writeHostAgent } from "@/lib/agents/host";
import {
  AGENT_CLEAR_LINE,
  buildFollowupBody,
  followupSubmit,
  sleep,
} from "./pty";
import { useAgentStore } from "./store";
import { useVaultStore } from "@/lib/vault/store";

export type PtySize = { cols: number; rows: number };

export type HostPty = {
  subscribe: (fn: (chunk: string) => void) => () => void;
  /** The visible terminal owns the size; the transcript screen follows it. */
  resize: (size: PtySize) => void;
  onResize: (fn: (size: PtySize) => void) => () => void;
  size: () => PtySize;
  write: (data: string) => void;
  writeFollowup: (text: string, profile: AgentChatProfile) => Promise<void>;
  live: boolean;
};

export function useHostPty(sessionId: string, active: boolean): HostPty {
  const listeners = useRef(new Set<(chunk: string) => void>());
  const sizeListeners = useRef(new Set<(size: PtySize) => void>());
  const sizeRef = useRef<PtySize>({ cols: 120, rows: 40 });
  const [live, setLive] = useState(active);
  const setStatus = useAgentStore((s) => s.setStatus);
  const mergeRemoteFiles = useVaultStore((s) => s.mergeRemoteFiles);
  const openPath = useVaultStore((s) => s.openPath);

  const subscribe = useCallback((fn: (chunk: string) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const resize = useCallback(
    (next: PtySize) => {
      const current = sizeRef.current;
      if (next.cols === current.cols && next.rows === current.rows) return;
      if (next.cols < 20 || next.rows < 5) return;
      sizeRef.current = next;
      void resizeHostAgent({ data: { sessionId, ...next } });
      for (const fn of sizeListeners.current) fn(next);
    },
    [sessionId],
  );

  const onResize = useCallback((fn: (size: PtySize) => void) => {
    sizeListeners.current.add(fn);
    return () => {
      sizeListeners.current.delete(fn);
    };
  }, []);

  const size = useCallback(() => sizeRef.current, []);

  const write = useCallback(
    (data: string) => {
      void writeHostAgent({ data: { sessionId, data } });
    },
    [sessionId],
  );

  const writeFollowup = useCallback(
    async (text: string, profile: AgentChatProfile) => {
      if (profile.clearComposer) {
        await writeHostAgent({ data: { sessionId, data: AGENT_CLEAR_LINE } });
        await sleep(40);
      }
      const body = buildFollowupBody(text, profile.followup);
      if (body) {
        await writeHostAgent({ data: { sessionId, data: body } });
        await sleep(profile.submitDelayMs);
      }
      await writeHostAgent({ data: { sessionId, data: followupSubmit(profile.followup) } });
      for (let i = 1; i < profile.submitCount; i += 1) {
        await sleep(90);
        await writeHostAgent({ data: { sessionId, data: followupSubmit(profile.followup) } });
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const started = Date.now();
    const emit = (chunk: string) => {
      if (!chunk) return;
      for (const fn of listeners.current) fn(chunk);
    };
    const tick = async () => {
      const result = await pollHostAgent({
        data: { sessionId, flushStdin: Date.now() - started > 800 },
      });
      if (cancelled) return;
      emit(result.output);
      const up = Boolean(result.ok && (result.running || result.writable));
      setLive(up || Date.now() - started < 4000);
      if (result.vault) mergeRemoteFiles(result.vault, openPath);
      if (up) setStatus(sessionId, "running");
      else if (result.ok && Date.now() - started > 4000) {
        setStatus(sessionId, "exited", { exitCode: result.exitCode });
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionId, active, mergeRemoteFiles, openPath, setStatus]);

  return useMemo(
    () => ({ subscribe, resize, onResize, size, write, writeFollowup, live }),
    [subscribe, resize, onResize, size, write, writeFollowup, live],
  );
}
