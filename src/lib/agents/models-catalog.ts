import type { LaunchableAgentId } from "./catalog.ts";
import type { ThinkingLevel } from "./types.ts";
import { modelsDevSnapshot } from "./models-dev-snapshot.ts";

export type CatalogEffort = { id: ThinkingLevel; label: string };

export type CatalogFamily = {
  id: string;
  label: string;
  efforts: CatalogEffort[];
  defaultEffort: ThinkingLevel;
};

export type ModelsDevModel = {
  id: string;
  name?: string;
  reasoning?: boolean;
  tool_call?: boolean;
  efforts?: string[];
  reasoning_options?: { type?: string; values?: string[] }[];
  modalities?: { output?: string[] };
  output?: string[];
};

export type ModelsDevProvider = {
  id?: string;
  models?: Record<string, ModelsDevModel>;
};

export type ModelsDevApi = Record<string, ModelsDevProvider>;

const EFFORT_LABEL: Record<string, string> = {
  none: "Off",
  off: "Off",
  minimal: "Min",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Xhigh",
  max: "Max",
};

const GROK_CLI_DEFAULTS = ["grok-4.6", "grok-4.5"] as const;
const CLAUDE_ALIASES: { id: string; label: string; catalogId: string }[] = [
  { id: "opus", label: "Opus 5", catalogId: "claude-opus-5" },
  { id: "sonnet", label: "Sonnet 5", catalogId: "claude-sonnet-5" },
  { id: "fable", label: "Fable 5.1", catalogId: "claude-fable-5-1" },
  { id: "haiku", label: "Haiku 4.5", catalogId: "claude-haiku-4-5" },
];

function asThinking(value: string): ThinkingLevel | null {
  if (value === "none") return "off";
  if (value === "minimal") return "low";
  if (
    value === "off" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  ) {
    return value;
  }
  return null;
}

export function effortsFromModel(model: ModelsDevModel | undefined): CatalogEffort[] {
  const raw =
    model?.efforts?.length
      ? model.efforts
      : model?.reasoning_options?.find((item) => item.type === "effort")?.values ?? [];
  const out: CatalogEffort[] = [];
  for (const value of raw) {
    const id = asThinking(value);
    if (!id) continue;
    if (out.some((item) => item.id === id)) continue;
    out.push({ id, label: EFFORT_LABEL[value] ?? value });
  }
  return out;
}

export function defaultEffortFor(efforts: CatalogEffort[]): ThinkingLevel {
  return (
    efforts.find((item) => item.id === "high")?.id ??
    efforts.find((item) => item.id === "medium")?.id ??
    efforts[0]?.id ??
    "high"
  );
}

function prettyId(id: string, name?: string): string {
  if (name?.trim()) return name.trim();
  return id
    .split(/[-_]/g)
    .map((part) => (part === "grok" ? "Grok" : part === "gpt" ? "GPT" : part.length <= 3 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

function isImagine(id: string): boolean {
  return /imagine|image|video|tts/i.test(id);
}

function familyFromModel(id: string, model?: ModelsDevModel, label?: string): CatalogFamily {
  const efforts = effortsFromModel(model);
  return {
    id,
    label: label ?? prettyId(id, model?.name),
    efforts,
    defaultEffort: defaultEffortFor(efforts),
  };
}

function providerModels(api: ModelsDevApi | null | undefined, provider: string): Record<string, ModelsDevModel> {
  const models = api?.[provider]?.models ?? snapshotApi()[provider]?.models ?? {};
  return models;
}

export function parseGrokModelsOutput(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as {
      models?: Array<string | { id?: string; model?: string }>;
      data?: Array<string | { id?: string; model?: string }>;
      default?: string;
    };
    const rows = parsed.models ?? parsed.data ?? [];
    const ids = rows
      .map((row) => (typeof row === "string" ? row : row.id ?? row.model ?? ""))
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length) return [...new Set(ids)];
  } catch {
    // plain text from `grok models`
  }
  const ids: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/^[*\-•]\s+([a-z0-9][\w.\-]*)/i) ?? line.match(/\b(grok-[\w.\-]+)\b/i);
    if (!match?.[1]) continue;
    ids.push(match[1]);
  }
  return [...new Set(ids)];
}

export function grokFamiliesFromCatalog(
  api: ModelsDevApi | null | undefined,
  hostIds: string[] = [],
): CatalogFamily[] {
  const catalog = providerModels(api, "xai");
  const available = hostIds.filter((id) => id && !isImagine(id));
  const ids = (available.length ? available : [...GROK_CLI_DEFAULTS]).filter((id) => !isImagine(id));
  const unique = [...new Set(ids)];
  unique.sort((a, b) => {
    const order = ["grok-4.6", "grok-4.5", "grok-4.3", "grok-build-0.1"];
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.localeCompare(b);
  });
  return unique.map((id) => familyFromModel(id, catalog[id]));
}

export function claudeFamiliesFromCatalog(api: ModelsDevApi | null | undefined): CatalogFamily[] {
  const catalog = providerModels(api, "anthropic");
  return CLAUDE_ALIASES.map((alias) => familyFromModel(alias.id, catalog[alias.catalogId], alias.label));
}

export function openaiFamiliesFromCatalog(api: ModelsDevApi | null | undefined): CatalogFamily[] {
  const catalog = providerModels(api, "openai");
  const preferred = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"];
  return preferred.filter((id) => catalog[id]).map((id) => familyFromModel(id, catalog[id]));
}

export function geminiFamiliesFromCatalog(api: ModelsDevApi | null | undefined): CatalogFamily[] {
  const catalog = providerModels(api, "google");
  const preferred = ["gemini-3.1-pro-preview", "gemini-3.8-flash", "gemini-2.5-pro", "gemini-2.5-flash"];
  return preferred.filter((id) => catalog[id]).map((id) => familyFromModel(id, catalog[id]));
}

export function familiesForAgent(
  agentId: LaunchableAgentId,
  api: ModelsDevApi | null | undefined,
  hostIds: string[] = [],
): CatalogFamily[] {
  switch (agentId) {
    case "grok":
      return grokFamiliesFromCatalog(api, hostIds);
    case "claude":
    case "openclaude":
      return claudeFamiliesFromCatalog(api);
    case "codex":
    case "cursor":
    case "droid":
      return openaiFamiliesFromCatalog(api);
    case "gemini":
    case "antigravity":
      return geminiFamiliesFromCatalog(api);
    case "copilot":
      return [
        ...openaiFamiliesFromCatalog(api).slice(0, 2),
        ...claudeFamiliesFromCatalog(api).slice(0, 2),
      ];
    default:
      return [];
  }
}

export function snapshotApi(): ModelsDevApi {
  return modelsDevSnapshot as unknown as ModelsDevApi;
}

export function parseModelsDevApi(raw: unknown): ModelsDevApi | null {
  if (!raw || typeof raw !== "object") return null;
  const blob = raw as ModelsDevApi;
  if (!blob.xai?.models && !blob.anthropic?.models) return null;
  return blob;
}
