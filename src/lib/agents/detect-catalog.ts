import {
  getTuiAgentDetectCommands,
  TUI_AGENTS,
  type TuiAgent,
  type TuiAgentDetectionRuntime,
} from "./catalog.ts";

export type TuiAgentDetectionCommand = {
  id: TuiAgent;
  cmd: string;
  requiredCommands?: readonly string[];
  unsupportedRuntimes?: readonly TuiAgentDetectionRuntime[];
};

function buildTuiAgentDetectionCommand(
  id: TuiAgent,
  cmd: string,
  spec: (typeof TUI_AGENTS)[number],
): TuiAgentDetectionCommand {
  return {
    id,
    cmd,
    ...(spec.detectRequiredCommands?.length
      ? { requiredCommands: spec.detectRequiredCommands }
      : {}),
    ...(spec.detectUnsupportedRuntimes?.length
      ? { unsupportedRuntimes: spec.detectUnsupportedRuntimes }
      : {}),
  };
}

export function buildTuiAgentDetectionCommands(): TuiAgentDetectionCommand[] {
  return TUI_AGENTS.flatMap((spec) =>
    getTuiAgentDetectCommands(spec).map((cmd) =>
      buildTuiAgentDetectionCommand(spec.id as TuiAgent, cmd, spec),
    ),
  );
}

export const KNOWN_TUI_AGENT_DETECTION_COMMANDS = buildTuiAgentDetectionCommands();

export function isDetectionUnsupportedInRuntime(
  command: TuiAgentDetectionCommand,
  runtime: TuiAgentDetectionRuntime,
): boolean {
  return command.unsupportedRuntimes?.includes(runtime) === true;
}

export function getTuiAgentDetectionProbeCommands(
  commands: readonly TuiAgentDetectionCommand[],
  runtime: TuiAgentDetectionRuntime,
): string[] {
  return [
    ...new Set(
      commands
        .filter((command) => !isDetectionUnsupportedInRuntime(command, runtime))
        .flatMap((command) => [command.cmd, ...(command.requiredCommands ?? [])]),
    ),
  ];
}

export function resolveDetectedTuiAgentIds(
  commands: readonly TuiAgentDetectionCommand[],
  foundCommands: ReadonlySet<string>,
  runtime: TuiAgentDetectionRuntime,
): TuiAgent[] {
  const detected = commands
    .filter(
      (command) =>
        !isDetectionUnsupportedInRuntime(command, runtime) &&
        foundCommands.has(command.cmd) &&
        (command.requiredCommands ?? []).every((required) => foundCommands.has(required)),
    )
    .map(({ id }) => id);
  return [...new Set(detected)];
}

export function firstToken(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(?:"([^"]+)"|'([^']+)'|(\S+))/);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? trimmed;
}
