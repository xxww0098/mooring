import { ChevronRight, FileText, Folder, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVaultStore } from "@/lib/vault/store";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const path of paths) {
    const parts = path.split("/");
    let level = root;
    let acc = "";
    for (let i = 0; i < parts.length; i += 1) {
      const name = parts[i];
      acc = acc ? `${acc}/${name}` : name;
      const isFile = i === parts.length - 1;
      let node = level.find((item) => item.name === name);
      if (!node) {
        node = { name, path: acc, children: isFile ? undefined : [] };
        level.push(node);
      }
      if (!isFile) {
        node.children ??= [];
        level = node.children;
      }
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const ad = a.children ? 0 : 1;
      const bd = b.children ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
  };
  sortNodes(root);
  return root;
}

function NodeRow({
  node,
  depth,
}: {
  node: TreeNode;
  depth: number;
}) {
  const openPath = useVaultStore((s) => s.openPath);
  const openNote = useVaultStore((s) => s.openNote);
  const deleteNote = useVaultStore((s) => s.deleteNote);
  const [open, setOpen] = useState(true);
  const isFile = !node.children;
  const active = isFile && openPath === node.path;

  if (!isFile) {
    return (
      <div>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-1 rounded-xs px-1 text-left text-[13px] text-muted hover:bg-elevated hover:text-fg"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronRight
            className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
          />
          <Folder className="size-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {open
          ? node.children?.map((child) => (
              <NodeRow key={child.path} node={child} depth={depth + 1} />
            ))
          : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex h-8 items-center gap-1 rounded-xs pr-1 text-[13px]",
        active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/70 hover:text-fg",
      )}
      style={{ paddingLeft: 8 + depth * 12 }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        onClick={() => openNote(node.path)}
      >
        <FileText className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate">{node.name.replace(/\.md$/, "")}</span>
      </button>
      <button
        type="button"
        className="flex size-6 items-center justify-center rounded-xs text-subtle opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100"
        aria-label={`删除 ${node.name}`}
        onClick={() => deleteNote(node.path)}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function FileTree() {
  const files = useVaultStore((s) => s.files);
  const filter = useVaultStore((s) => s.filter);
  const setFilter = useVaultStore((s) => s.setFilter);
  const createNote = useVaultStore((s) => s.createNote);
  const [draft, setDraft] = useState<string | null>(null);

  const paths = useMemo(() => {
    const all = Object.keys(files);
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((path) => path.toLowerCase().includes(q));
  }, [files, filter]);

  const tree = useMemo(() => buildTree(paths), [paths]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="筛选笔记"
          aria-label="筛选笔记"
          className="h-8 bg-paper"
        />
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="新建笔记"
          onClick={() => setDraft("Untitled.md")}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {draft !== null ? (
        <form
          className="px-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = draft.trim();
            if (!next) {
              setDraft(null);
              return;
            }
            createNote(next);
            setDraft(null);
          }}
        >
          <Input
            autoFocus
            value={draft}
            aria-label="新笔记路径"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDraft(null);
            }}
            onBlur={() => {
              if (!draft.trim()) setDraft(null);
            }}
          />
        </form>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {tree.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-subtle">没有匹配的笔记</p>
        ) : (
          tree.map((node) => <NodeRow key={node.path} node={node} depth={0} />)
        )}
      </div>
    </div>
  );
}
