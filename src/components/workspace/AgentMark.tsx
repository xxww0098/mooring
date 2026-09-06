import { CircleDashed, SquareTerminal, Terminal } from "lucide-react";
import type { JSX } from "react";
import type { DefaultAgentId, LaunchableAgentId } from "@/lib/agents/catalog";
import { AGENT_FAVICON_DOMAINS, AGENT_ICON_URLS } from "@/lib/agents/icon-assets";
import { cn } from "@/lib/utils";
import {
  AiderIcon,
  AgentLetterIcon,
  ClaudeIcon,
  CopilotIcon,
  DroidIcon,
  KiloIcon,
  OmpIcon,
  OpenAIIcon,
  OpenCodeIcon,
  PiIcon,
} from "./agent-glyphs";

type MarkId = LaunchableAgentId | DefaultAgentId;

const GLYPHS: Partial<Record<MarkId, (props: { size?: number }) => JSX.Element>> = {
  claude: ClaudeIcon,
  codex: OpenAIIcon,
  droid: DroidIcon,
  pi: PiIcon,
  omp: OmpIcon,
  aider: AiderIcon,
  kilo: KiloIcon,
  copilot: CopilotIcon,
  opencode: OpenCodeIcon,
};

export function AgentMark({
  id,
  className,
}: {
  id: MarkId | string;
  className?: string;
}) {
  const cls = cn("size-4 shrink-0", className);

  if (id === "auto") return <CircleDashed className={cls} strokeWidth={1.75} />;
  if (id === "blank") return <Terminal className={cls} strokeWidth={1.75} />;
  if (id === "custom" || id === "terminal") return <SquareTerminal className={cls} strokeWidth={1.75} />;

  const Glyph = GLYPHS[id as MarkId];
  if (Glyph) {
    return (
      <span className={cn("inline-flex items-center justify-center [&>svg]:size-full", cls)}>
        <Glyph size={16} />
      </span>
    );
  }

  const bundled = AGENT_ICON_URLS[id as LaunchableAgentId];
  if (bundled) {
    return (
      <img src={bundled} alt="" aria-hidden className={cn("rounded-[2px] object-contain", cls)} />
    );
  }

  const domain = AGENT_FAVICON_DOMAINS[id as LaunchableAgentId];
  if (domain) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        aria-hidden
        className={cn("rounded-[2px] object-contain", cls)}
      />
    );
  }

  const letter = String(id).charAt(0).toUpperCase() || "?";
  return (
    <span className={cn("inline-flex items-center justify-center [&>svg]:size-full", cls)}>
      <AgentLetterIcon letter={letter} size={16} />
    </span>
  );
}
