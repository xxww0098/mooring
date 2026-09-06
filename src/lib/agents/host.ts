import { createServerFn } from "@tanstack/react-start";
import type { AgentPermissionMode, LaunchableAgentId } from "./catalog";
import * as runtime from "./runtime";

export const probeHostAgents = createServerFn({ method: "GET" }).handler(async () => {
  return runtime.probeHostAgents();
});

export const probeHostCommand = createServerFn({ method: "POST" })
  .validator((input: { command: string }) => input)
  .handler(async ({ data }) => runtime.probeHostCommand(data));

export const launchHostAgent = createServerFn({ method: "POST" })
  .validator(
    (input: {
      sessionId: string;
      agentId: LaunchableAgentId;
      prompt?: string;
      vault: Record<string, string>;
      customCommand?: string;
      permissionMode?: AgentPermissionMode;
    }) => input,
  )
  .handler(async ({ data }) => runtime.launchHostAgent(data));

export const saveHostAttachments = createServerFn({ method: "POST" })
  .validator((input: { files: Array<{ relPath: string; base64: string }> }) => input)
  .handler(async ({ data }) => runtime.saveHostAttachments(data));

export const writeHostAgent = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string; data: string }) => input)
  .handler(async ({ data }) => runtime.writeHostAgent(data));

export const killHostAgent = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string }) => input)
  .handler(async ({ data }) => runtime.killHostAgent(data));

export const pollHostAgent = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string; flushStdin?: boolean }) => input)
  .handler(async ({ data }) => runtime.pollHostAgent(data));
