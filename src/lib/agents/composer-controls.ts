import type { LaunchableAgentId } from "./catalog";
import type { AccessMode, ThinkingLevel } from "./types";
import { familiesForAgent, snapshotApi } from "./models-catalog.ts";

export type ComposerEffort = { id: ThinkingLevel; label: string };

export type ComposerModelFamily = {
  id: string;
  label: string;
  efforts: ComposerEffort[];
  defaultEffort: ThinkingLevel;
};

export type ComposerModel = { id: string; label: string };

export const ACCESS_OPTIONS: { id: AccessMode; label: string }[] = [
  { id: "full", label: "完全权限" },
  { id: "workspace", label: "工作区写入" },
  { id: "read", label: "只读" },
];

export function composerFamilies(
  agentId: LaunchableAgentId,
  live?: ComposerModelFamily[] | null,
): ComposerModelFamily[] {
  if (live?.length) return live;
  return familiesForAgent(agentId, snapshotApi());
}

export function composerModels(agentId: LaunchableAgentId, live?: ComposerModelFamily[] | null): ComposerModel[] {
  return composerFamilies(agentId, live).map((family) => ({ id: family.id, label: family.label }));
}

export function resolveFamily(
  families: ComposerModelFamily[],
  modelId: string | undefined,
): ComposerModelFamily | null {
  if (families.length === 0) return null;
  return families.find((family) => family.id === modelId) ?? families[0] ?? null;
}

export function resolveEffort(family: ComposerModelFamily, thinking: ThinkingLevel | undefined): ThinkingLevel {
  if (family.efforts.length === 0) return family.defaultEffort;
  if (thinking && family.efforts.some((item) => item.id === thinking)) return thinking;
  return family.defaultEffort;
}

export function formatModelChip(family: ComposerModelFamily, effort: ThinkingLevel): string {
  const label = family.efforts.find((item) => item.id === effort)?.label;
  return label ? `${family.label} ${label}` : family.label;
}

export function composerSupportsThinking(agentId: LaunchableAgentId): boolean {
  return composerFamilies(agentId).some((family) => family.efforts.length > 0);
}

export function modelCommand(modelId: string): string {
  return `/model ${modelId}`;
}

export function thinkingCommand(agentId: LaunchableAgentId, level: ThinkingLevel): string | null {
  if (level === "off") {
    if (agentId === "claude" || agentId === "openclaude") return "/effort auto";
    if (agentId === "grok") return "/effort none";
    return null;
  }
  if (agentId === "grok") return `/effort ${level}`;
  if (agentId === "claude" || agentId === "openclaude") return `/effort ${level}`;
  return null;
}

export function accessCommand(agentId: LaunchableAgentId, mode: AccessMode): string | null {
  if (agentId === "claude" || agentId === "openclaude") return "/permissions";
  if (agentId === "codex") return "/approvals";
  return null;
}

export function defaultAccess(yolo: boolean): AccessMode {
  return yolo ? "full" : "read";
}
