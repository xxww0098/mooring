import { ItemView, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { AgentDock } from "@/components/workspace/AgentDock";
import type MooringPlugin from "./main";

export const VIEW_TYPE_MOORING = "mooring-dock";

export class MooringView extends ItemView {
  root: Root | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    public plugin: MooringPlugin,
  ) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_MOORING;
  }

  getDisplayText() {
    return "Mooring";
  }

  getIcon() {
    return "bot";
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("mooring-root");
    this.plugin.syncVaultFiles();
    this.root = createRoot(this.contentEl);
    this.root.render(<AgentDock />);
  }

  async onClose() {
    this.root?.unmount();
    this.root = null;
  }
}
