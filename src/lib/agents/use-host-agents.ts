import { useCallback, useEffect, useMemo, useState } from "react";
import { probeHostAgents } from "./host";
import {
  formatLaunchDisplay,
  getTuiAgentDetectCommands,
  TUI_AGENTS,
  TUI_AGENT_AUTO_PICK_ORDER,
} from "./catalog";
import type { TuiAgent } from "./catalog";
import { useAgentStore } from "./store";
import type { HostAgentProbe } from "./types";

export function catalogProbes(detected: Iterable<TuiAgent> = []): HostAgentProbe[] {
  const detectedSet = new Set(detected);
  return TUI_AGENTS.map((spec) => {
    const id = spec.id as HostAgentProbe["id"];
    const available = detectedSet.has(id);
    return {
      id,
      name: spec.name,
      launchCommand: formatLaunchDisplay(spec),
      detectCmd: spec.detectCmd,
      detectCommands: getTuiAgentDetectCommands(spec),
      requiredCommands: [...(spec.detectRequiredCommands ?? [])],
      available,
      resolvedPath: null,
      resolvedCmd: null,
      missingReason: available ? null : "not-on-path",
      missingDetail: available ? null : `PATH 上没有 ${getTuiAgentDetectCommands(spec).join(" / ")}`,
      yolo: Boolean(spec.yoloArgs) || Boolean(spec.yoloEnv),
    };
  });
}

export function useHostAgents(active: boolean) {
  const disabledAgentIds = useAgentStore((s) => s.disabledAgentIds);
  const detectedAgentIds = useAgentStore((s) => s.detectedAgentIds);
  const setDetectedAgents = useAgentStore((s) => s.setDetectedAgents);
  const setModelCatalogs = useAgentStore((s) => s.setModelCatalogs);
  const [probes, setProbes] = useState<HostAgentProbe[]>(() => catalogProbes(detectedAgentIds));
  const [probing, setProbing] = useState(false);

  const refresh = useCallback(() => {
    setProbing(true);
    void probeHostAgents()
      .then((result) => {
        setProbes(result.agents);
        setDetectedAgents(result.agents.filter((item) => item.available).map((item) => item.id));
        if (result.catalogs) setModelCatalogs(result.catalogs);
      })
      .finally(() => setProbing(false));
  }, [setDetectedAgents, setModelCatalogs]);

  useEffect(() => {
    if (!active) return;
    refresh();
  }, [active, refresh]);

  const disabledSet = useMemo(() => new Set(disabledAgentIds), [disabledAgentIds]);
  const available = useMemo(() => probes.filter((item) => item.available), [probes]);
  const launchable = useMemo(
    () =>
      available
        .filter((item) => !disabledSet.has(item.id))
        .slice()
        .sort((a, b) => {
          const ai = TUI_AGENT_AUTO_PICK_ORDER.indexOf(a.id);
          const bi = TUI_AGENT_AUTO_PICK_ORDER.indexOf(b.id);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        }),
    [available, disabledSet],
  );

  return { probes, probing, refresh, disabledSet, available, launchable };
}
