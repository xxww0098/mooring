import { useEffect, useRef } from "react";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import type { Terminal as TerminalType } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { HostPty } from "@/lib/agents/use-host-pty";

export function AgentTerminal({
  sessionId,
  visible,
  pty,
}: {
  sessionId: string;
  visible: boolean;
  pty: HostPty;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<TerminalType | null>(null);
  const fitRef = useRef<FitAddonType | null>(null);
  const pendingRef = useRef("");

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let disposed = false;
    void Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(
      ([{ Terminal }, { FitAddon }]) => {
        if (disposed || !hostRef.current) return;
        const term = new Terminal({
          convertEol: true,
          fontFamily: "IBM Plex Mono, ui-monospace, monospace",
          fontSize: 13,
          theme: {
            background: "#141416",
            foreground: "#eceae6",
            cursor: "#b7c4b2",
            cursorAccent: "#0c0c0d",
          },
          cursorBlink: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current);
        fit.fit();
        termRef.current = term;
        fitRef.current = fit;
        if (pendingRef.current) {
          term.write(pendingRef.current);
          pendingRef.current = "";
        }
        term.onData((data) => pty.write(data));
      },
    );
    const onResize = () => fitRef.current?.fit();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [sessionId, pty]);

  useEffect(() => {
    return pty.subscribe((chunk) => {
      const term = termRef.current;
      if (term) term.write(chunk);
      else pendingRef.current += chunk;
    });
  }, [pty]);

  useEffect(() => {
    if (visible) fitRef.current?.fit();
  }, [visible]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-48 w-full overflow-hidden bg-surface"
      hidden={!visible}
    />
  );
}
