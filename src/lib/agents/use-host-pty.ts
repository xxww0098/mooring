import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentChatProfile } from "./chat-profile";
import { pollHostAgent, writeHostAgent } from "./host";
import {
  AGENT_CLEAR_LINE,
  buildFollowupBody,
  followupSubmit,
  sleep,
} from "./pty";
import { useAgentStore } from "./store";
import { useVaultStore } from "@/lib/vault/store";

export type HostPty = {
  subscribe: (fn: (chunk: string) => void) => () => void;
  write: (data: string) => void;
  writeFollowup: (text: string, profile: AgentChatProfile) => Promise<void>;
  live: boolean;
};

export function useHostPty(sessionId: string, active: boolean): HostPty {
  const listeners = useRef(new Set<(chunk: string) => void>());
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
    () => ({ subscribe, write, writeFollowup, live }),
    [subscribe, write, writeFollowup, live],
  );
}
