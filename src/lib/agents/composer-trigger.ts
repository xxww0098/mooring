export type ComposerTriggerKind = "slash" | "mention";

export type ComposerTrigger = {
  kind: ComposerTriggerKind;
  query: string;
  start: number;
  end: number;
};

export function detectComposerTrigger(text: string, cursor: number): ComposerTrigger | null {
  const pos = Math.max(0, Math.min(cursor, text.length));
  const before = text.slice(0, pos);

  const slash = before.match(/(^|\n)(\s*)\/([^\s]*)$/);
  if (slash) {
    const query = slash[3] ?? "";
    const start = pos - query.length - 1;
    return { kind: "slash", query, start, end: pos };
  }

  const mention = before.match(/(^|[\s])@([^\s]*)$/);
  if (mention) {
    const query = mention[2] ?? "";
    const start = pos - query.length - 1;
    return { kind: "mention", query, start, end: pos };
  }

  return null;
}

export function applyComposerInsert(
  text: string,
  trigger: ComposerTrigger,
  insert: string,
): { text: string; cursor: number } {
  const next = `${text.slice(0, trigger.start)}${insert}${text.slice(trigger.end)}`;
  return { text: next, cursor: trigger.start + insert.length };
}

export function filterMentionPaths(paths: string[], query: string): string[] {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  return paths
    .filter((path) => !q || path.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 8);
}
