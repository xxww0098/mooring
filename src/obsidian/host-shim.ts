import * as runtime from "@/lib/agents/runtime";

export async function probeHostAgents() {
  return runtime.probeHostAgents();
}

export async function probeHostCommand(input: { data: { command: string } }) {
  return runtime.probeHostCommand(input.data);
}

export async function launchHostAgent(input: { data: Parameters<typeof runtime.launchHostAgent>[0] }) {
  return runtime.launchHostAgent(input.data);
}

export async function saveHostAttachments(input: {
  data: { files: Array<{ relPath: string; base64: string }> };
}) {
  return runtime.saveHostAttachments(input.data);
}

export async function writeHostAgent(input: { data: { sessionId: string; data: string } }) {
  return runtime.writeHostAgent(input.data);
}

export async function killHostAgent(input: { data: { sessionId: string } }) {
  return runtime.killHostAgent(input.data);
}

export async function pollHostAgent(input: { data: { sessionId: string; flushStdin?: boolean } }) {
  return runtime.pollHostAgent(input.data);
}
