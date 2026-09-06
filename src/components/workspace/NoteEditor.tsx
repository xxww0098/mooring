import { Eye, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/lib/markdown";
import { currentNote, useVaultStore } from "@/lib/vault/store";

export function NoteEditor() {
  const files = useVaultStore((s) => s.files);
  const openPath = useVaultStore((s) => s.openPath);
  const setContent = useVaultStore((s) => s.setContent);
  const openNote = useVaultStore((s) => s.openNote);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const note = currentNote(files, openPath);

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center bg-paper text-sm text-subtle">
        选择一篇笔记
      </div>
    );
  }

  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="min-w-0">
          <p className="truncate font-serif text-[15px] font-medium tracking-tight">
            {note.path.replace(/\.md$/, "")}
          </p>
          <p className="text-[11px] text-subtle tabular-nums">{words} words</p>
        </div>
        <div className="flex rounded-sm border border-border p-0.5">
          <Button
            size="icon-sm"
            variant={mode === "edit" ? "outline" : "ghost"}
            aria-label="编辑"
            aria-pressed={mode === "edit"}
            onClick={() => setMode("edit")}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant={mode === "preview" ? "outline" : "ghost"}
            aria-label="预览"
            aria-pressed={mode === "preview"}
            onClick={() => setMode("preview")}
          >
            <Eye className="size-3.5" />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode === "edit" ? (
          <textarea
            value={note.content}
            onChange={(e) => setContent(note.path, e.target.value)}
            spellCheck={false}
            aria-label={note.path}
            className="h-full min-h-[24rem] w-full resize-none bg-transparent px-5 py-4 font-sans text-[15px] leading-7 text-fg outline-none"
          />
        ) : (
          <div className="px-5 py-4">
            <MarkdownView source={note.content} onOpen={openNote} />
          </div>
        )}
      </div>
    </div>
  );
}
