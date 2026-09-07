import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isAgentPermissionMode, isTuiAgent, nextSessionName, sessionTitle } from "./catalog";
import type { AgentPermissionMode, DefaultAgentId, LaunchableAgentId, TuiAgent } from "./catalog";
import type { AgentSession, AgentStatus, AgentViewMode, ChatMessage } from "./types";
import { isAccessMode, isAgentViewMode, isThinkingLevel } from "./types";
import { supportsChatUi } from "./chat-profile";
import type { CatalogFamily } from "./models-catalog";
import { uid } from "@/lib/utils";

interface AgentState {
  agents: AgentSession[];
  activeId: string | null;
  defaultAgentId: DefaultAgentId;
  permissionMode: AgentPermissionMode;
  defaultViewMode: AgentViewMode;
  detectedAgentIds: TuiAgent[];
  disabledAgentIds: TuiAgent[];
  modelCatalogs: Partial<Record<LaunchableAgentId, CatalogFamily[]>>;
  hydrated: boolean;
  setHydrated: () => void;
  setDefaultAgent: (id: DefaultAgentId) => void;
  setPermissionMode: (mode: AgentPermissionMode) => void;
  setDefaultViewMode: (mode: AgentViewMode) => void;
  setDetectedAgents: (ids: TuiAgent[]) => void;
  setModelCatalogs: (catalogs: Partial<Record<LaunchableAgentId, CatalogFamily[]>>) => void;
  setAgentEnabled: (id: TuiAgent, enabled: boolean) => void;
  createAgent: (input: {
    name?: string;
    agentId: LaunchableAgentId;
    launchCommand: string;
    viewMode?: AgentViewMode;
  }) => string;
  selectAgent: (id: string) => void;
  removeAgent: (id: string) => void;
  setStatus: (
    id: string,
    status: AgentStatus,
    extra?: { exitCode?: number | null; error?: string | null },
  ) => void;
  setViewMode: (id: string, viewMode: AgentViewMode) => void;
  patchSession: (id: string, patch: Partial<Pick<AgentSession, "modelId" | "thinking" | "accessMode" | "context">>) => void;
  appendMessage: (id: string, message: ChatMessage) => void;
  patchMessage: (id: string, messageId: string, patch: Partial<ChatMessage>) => void;
  removeMessages: (id: string, messageIds: string[]) => void;
}

/** Chat is opt-in per agent; anything Mooring cannot scrape stays in the terminal. */
function resolveViewMode(agentId: LaunchableAgentId, requested: unknown): AgentViewMode {
  return requested !== "terminal" && supportsChatUi(agentId) ? "chat" : "terminal";
}

function normalizeSession(agent: AgentSession): AgentSession {
  return {
    ...agent,
    viewMode: resolveViewMode(agent.agentId, agent.viewMode),
    messages: Array.isArray(agent.messages) ? agent.messages : [],
    modelId: typeof agent.modelId === "string" ? agent.modelId : undefined,
    thinking: isThinkingLevel(agent.thinking) ? agent.thinking : undefined,
    accessMode: isAccessMode(agent.accessMode) ? agent.accessMode : undefined,
  };
}

function isCanonicalSessionName(name: string, agentId: LaunchableAgentId): boolean {
  const base = sessionTitle(agentId);
  if (name === base) return true;
  const rest = name.slice(base.length);
  return name.startsWith(`${base} `) && /^\d+$/.test(rest.trim());
}

function remapSessionNames(agents: AgentSession[]): AgentSession[] {
  const used: string[] = [];
  return agents.map((agent) => {
    const name = isCanonicalSessionName(agent.name, agent.agentId)
      ? agent.name
      : nextSessionName(agent.agentId, used);
    used.push(name);
    return { ...agent, name };
  });
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [],
      activeId: null,
      defaultAgentId: "auto",
      permissionMode: "yolo",
      defaultViewMode: "chat",
      detectedAgentIds: [],
      disabledAgentIds: [],
      modelCatalogs: {},
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setDefaultAgent: (id) => set({ defaultAgentId: id }),
      setPermissionMode: (mode) => set({ permissionMode: mode }),
      setDefaultViewMode: (mode) => set({ defaultViewMode: mode }),
      setDetectedAgents: (ids) => set({ detectedAgentIds: ids.filter(isTuiAgent) }),
      setModelCatalogs: (catalogs) => set({ modelCatalogs: catalogs }),
      setAgentEnabled: (id, enabled) => {
        const current = new Set(get().disabledAgentIds);
        if (enabled) current.delete(id);
        else current.add(id);
        const disabledAgentIds = [...current];
        const defaultAgentId = get().defaultAgentId;
        set({
          disabledAgentIds,
          defaultAgentId:
            !enabled && defaultAgentId === id ? "auto" : defaultAgentId,
        });
      },
      createAgent: ({ name, agentId, launchCommand, viewMode }) => {
        const id = uid("agent");
        const session: AgentSession = {
          id,
          name: name?.trim() || nextSessionName(agentId, get().agents.map((a) => a.name)),
          agentId,
          launchCommand,
          createdAt: Date.now(),
          status: "starting",
          exitCode: null,
          error: null,
          viewMode: resolveViewMode(agentId, viewMode),
          messages: [],
        };
        set({
          agents: [session, ...get().agents],
          activeId: id,
        });
        return id;
      },
      selectAgent: (id) => {
        if (!get().agents.some((agent) => agent.id === id)) return;
        set({ activeId: id });
      },
      removeAgent: (id) => {
        const agents = get().agents.filter((agent) => agent.id !== id);
        const activeId =
          get().activeId === id ? (agents[0]?.id ?? null) : get().activeId;
        set({ agents, activeId });
      },
      setStatus: (id, status, extra) => {
        set({
          agents: get().agents.map((agent) =>
            agent.id === id
              ? {
                  ...agent,
                  status,
                  exitCode: extra?.exitCode ?? agent.exitCode,
                  error: extra?.error === undefined ? agent.error : extra.error,
                }
              : agent,
          ),
        });
      },
      setViewMode: (id, viewMode) => {
        set({
          agents: get().agents.map((agent) =>
            agent.id === id ? { ...agent, viewMode: resolveViewMode(agent.agentId, viewMode) } : agent,
          ),
        });
      },
      patchSession: (id, patch) => {
        set({
          agents: get().agents.map((agent) =>
            agent.id === id ? { ...agent, ...patch } : agent,
          ),
        });
      },
      appendMessage: (id, message) => {
        set({
          agents: get().agents.map((agent) =>
            agent.id === id ? { ...agent, messages: [...agent.messages, message] } : agent,
          ),
        });
      },
      removeMessages: (id, messageIds) => {
        const drop = new Set(messageIds);
        set({
          agents: get().agents.map((agent) =>
            agent.id === id
              ? { ...agent, messages: agent.messages.filter((item) => !drop.has(item.id)) }
              : agent,
          ),
        });
      },
      patchMessage: (id, messageId, patch) => {
        set({
          agents: get().agents.map((agent) =>
            agent.id === id
              ? {
                  ...agent,
                  messages: agent.messages.map((item) =>
                    item.id === messageId ? { ...item, ...patch } : item,
                  ),
                }
              : agent,
          ),
        });
      },
    }),
    {
      name: "mooring-agents-v7",
      partialize: (state) => ({
        agents: state.agents.map((agent) => ({
          ...normalizeSession(agent),
          status:
            agent.status === "running" || agent.status === "starting"
              ? "exited"
              : agent.status,
          messages: (agent.messages ?? []).map((message) => ({
            ...message,
            pending: false,
            attachments: (message.attachments ?? []).map((item) => ({
              id: item.id,
              kind: item.kind,
              name: item.name,
              mime: item.mime,
              size: item.size,
              relPath: item.relPath,
            })),
          })),
        })),
        activeId: state.activeId,
        defaultAgentId: state.defaultAgentId,
        permissionMode: state.permissionMode,
        defaultViewMode: state.defaultViewMode,
        detectedAgentIds: state.detectedAgentIds.filter(isTuiAgent),
        disabledAgentIds: state.disabledAgentIds.filter(isTuiAgent),
        modelCatalogs: state.modelCatalogs,
      }),
      merge: (persisted, current) => {
        const blob = (persisted ?? {}) as Partial<AgentState>;
        return {
          ...current,
          ...blob,
          agents: remapSessionNames((blob.agents ?? []).map(normalizeSession)),
          permissionMode: isAgentPermissionMode(blob.permissionMode)
            ? blob.permissionMode
            : current.permissionMode,
          defaultViewMode: isAgentViewMode(blob.defaultViewMode)
            ? blob.defaultViewMode
            : current.defaultViewMode,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
