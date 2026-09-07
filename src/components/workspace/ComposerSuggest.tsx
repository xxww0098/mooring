import { AtSign, Command, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type SuggestItem = {
  id: string;
  title: string;
  description?: string;
  insert: string;
  kind: "slash" | "mention" | "skill";
};

export function ComposerSuggest({
  items,
  active,
  onActive,
  onChoose,
}: {
  items: SuggestItem[];
  active: number;
  onActive: (index: number) => void;
  onChoose: (item: SuggestItem) => void;
}) {
  if (items.length === 0) return null;
  const kind = items[0]?.kind === "slash" ? "slash" : "mention";
  const label = kind === "slash" ? "命令" : "引用";
  return (
    <div
      role="listbox"
      aria-label={label}
      className="mb-1 max-h-52 overflow-y-auto rounded-sm border border-border bg-paper py-1 shadow-[var(--shadow-border)]"
    >
      {items.map((item, index) => {
        const selected = index === active;
        const slash = item.kind === "slash";
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseEnter={() => onActive(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              onChoose(item);
            }}
            className={cn(
              "flex h-row w-full items-center gap-2 border-l-2 px-3 text-left text-body transition-colors duration-[var(--duration-quick)]",
              selected
                ? slash
                  ? "border-l-accent bg-accent/15 text-fg"
                  : "border-l-[#8fa4c4] bg-[#8fa4c4]/15 text-fg"
                : "border-l-transparent text-muted hover:bg-elevated/70 hover:text-fg",
            )}
          >
            {slash ? (
              <Command
                className={cn("size-3.5 shrink-0", selected ? "text-accent" : "text-accent/70")}
              />
            ) : item.kind === "skill" ? (
              <Sparkles
                className={cn("size-3.5 shrink-0", selected ? "text-accent" : "text-accent/70")}
              />
            ) : item.kind === "mention" ? (
              <FileText
                className={cn("size-3.5 shrink-0", selected ? "text-[#8fa4c4]" : "text-[#8fa4c4]/70")}
              />
            ) : (
              <AtSign className="size-3.5 shrink-0" />
            )}
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-medium",
                selected ? "text-fg" : "text-muted",
              )}
            >
              {item.title}
            </span>
            {item.description ? (
              <span className={cn("max-w-[50%] truncate text-meta", selected ? "text-muted" : "text-subtle")}>
                {item.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
