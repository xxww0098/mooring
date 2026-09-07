import { useEffect, useRef } from "react";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import type { Terminal as TerminalType } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { HostPty } from "@/lib/agents/use-host-pty";
import { cn } from "@/lib/utils";

function readTerminalTheme(host: HTMLElement) {
  const style = getComputedStyle(host);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    background: token("--color-surface", "#141416"),
    foreground: token("--color-fg", "#eceae6"),
    cursor: token("--color-accent", "#b7c4b2"),
    cursorAccent: token("--color-bg", "#0c0c0d"),
  };
}

function fitWhenSized(fit: FitAddonType, host: HTMLElement, term: TerminalType | null, pty: HostPty) {
  if (host.clientWidth < 8 || host.clientHeight < 8) return;
  fit.fit();
  // The TUI draws with absolute cursor moves; if the pty's idea of the width differs
  // from what we render into, every frame tears. Push our size down to the pty.
  if (term) pty.resize({ cols: term.cols, rows: term.rows });
}

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
          theme: readTerminalTheme(el),
          cursorBlink: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current);
        fitWhenSized(fit, hostRef.current, term, pty);
        termRef.current = term;
        fitRef.current = fit;
        if (pendingRef.current) {
          term.write(pendingRef.current);
          pendingRef.current = "";
        }
        term.onData((data) => pty.write(data));
      },
    );
    // The pane starts hidden when chat is the default view; fitting a zero-width
    // element wraps everything the CLI writes at ~10 columns.
    const observer = new ResizeObserver(() => {
      if (fitRef.current) fitWhenSized(fitRef.current, el, termRef.current, pty);
    });
    observer.observe(el);
    // xterm colours are JS options, not CSS, so re-read the tokens when the host theme flips.
    const applyTheme = () => {
      if (termRef.current) termRef.current.options.theme = readTerminalTheme(el);
    };
    const themeWatcher = new MutationObserver(applyTheme);
    themeWatcher.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", applyTheme);
    return () => {
      disposed = true;
      observer.disconnect();
      themeWatcher.disconnect();
      scheme.removeEventListener("change", applyTheme);
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
    const el = hostRef.current;
    if (visible && fitRef.current && el) fitWhenSized(fitRef.current, el, termRef.current, pty);
  }, [visible, pty]);

  return (
    <div
      ref={hostRef}
      aria-hidden={!visible}
      className={cn(
        "h-full min-h-48 w-full overflow-hidden bg-surface",
        !visible && "pointer-events-none invisible",
      )}
    />
  );
}
