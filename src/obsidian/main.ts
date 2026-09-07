import { FileSystemAdapter, Plugin, WorkspaceLeaf } from "obsidian";
import { join } from "node:path";
import { configureHost, killAllHostAgents } from "@/lib/agents/runtime";
import { useVaultStore } from "@/lib/vault/store";
import { MooringView, VIEW_TYPE_MOORING } from "./view";

export default class MooringPlugin extends Plugin {
  async onload() {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      const vaultDir = adapter.getBasePath();
      configureHost({
        vaultDir,
        cacheDir: join(vaultDir, ".mooring"),
        writeVaultOnLaunch: false,
      });
    }

    this.registerView(VIEW_TYPE_MOORING, (leaf) => new MooringView(leaf, this));
    this.addRibbonIcon("bot", "Mooring", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open-mooring",
      name: "打开 Mooring",
      callback: () => {
        void this.activateView();
      },
    });
    this.registerEvent(this.app.vault.on("create", () => this.syncVaultFiles()));
    this.registerEvent(this.app.vault.on("delete", () => this.syncVaultFiles()));
    this.registerEvent(this.app.vault.on("rename", () => this.syncVaultFiles()));
    this.app.workspace.onLayoutReady(() => this.syncVaultFiles());
  }

  onunload() {
    killAllHostAgents();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_MOORING);
  }

  syncVaultFiles() {
    const files: Record<string, { path: string; content: string; updatedAt: number }> = {};
    for (const file of this.app.vault.getMarkdownFiles()) {
      files[file.path] = { path: file.path, content: "", updatedAt: file.stat.mtime };
    }
    const openPath = Object.keys(files)[0] ?? "";
    useVaultStore.setState({ files, openPath, hydrated: true });
  }

  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_MOORING);
    if (existing[0]) {
      await workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf: WorkspaceLeaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_MOORING, active: true });
    await workspace.revealLeaf(leaf);
  }
}
