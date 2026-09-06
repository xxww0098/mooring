import { uid } from "../utils.ts";

export type ComposerRefKind = "file" | "skill";

export type ComposerRef = {
  id: string;
  kind: ComposerRefKind;
  label: string;
  value: string;
};

export function makeRef(kind: ComposerRefKind, value: string, label = value): ComposerRef {
  return { id: uid("ref"), kind, label, value };
}

export function mergeRefs(current: ComposerRef[], incoming: ComposerRef[]): ComposerRef[] {
  const next = [...current];
  for (const item of incoming) {
    if (next.some((row) => row.kind === item.kind && row.value === item.value)) continue;
    next.push(item);
  }
  return next;
}

export function fileLabel(path: string): string {
  return path.split("/").pop() || path;
}

const TOKEN = /(?:^|[\s])@([^\s]+)/g;

export function promoteCompletedRefs(
  text: string,
  knownFiles: string[],
  knownSkills: string[],
  skipIncomplete: boolean,
): { text: string; refs: ComposerRef[] } {
  const files = new Map(knownFiles.map((path) => [path.toLowerCase(), path]));
  const skills = new Map(knownSkills.map((name) => [name.toLowerCase(), name]));
  const refs: ComposerRef[] = [];
  const ranges: Array<{ start: number; end: number }> = [];
  TOKEN.lastIndex = 0;
  let match = TOKEN.exec(text);
  while (match) {
    const raw = match[1] ?? "";
    const at = match.index + match[0].indexOf("@");
    const end = at + raw.length + 1;
    const atEnd = end >= text.length;
    if (skipIncomplete && atEnd) {
      match = TOKEN.exec(text);
      continue;
    }
    const key = raw.toLowerCase().replace(/^@/, "");
    const file = files.get(key) ?? [...files.values()].find((path) => path.toLowerCase().endsWith(`/${key}`));
    const skill = skills.get(key);
    if (file) {
      refs.push(makeRef("file", file, fileLabel(file)));
      ranges.push({ start: at, end });
    } else if (skill) {
      refs.push(makeRef("skill", skill, skill));
      ranges.push({ start: at, end });
    }
    match = TOKEN.exec(text);
  }
  if (!ranges.length) return { text, refs: [] };
  let next = text;
  for (const range of [...ranges].reverse()) {
    next = `${next.slice(0, range.start)}${next.slice(range.end)}`;
  }
  return { text: next.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n"), refs };
}

export function buildRefPrompt(text: string, refs: ComposerRef[]): string {
  const body = text.trim();
  if (refs.length === 0) return body;
  const lines = refs.map((item) =>
    item.kind === "file" ? `- 笔记 ${item.value}` : `- 技能 ${item.value}`,
  );
  const header = body || "请阅读引用内容。";
  return `${header}\n\n引用：\n${lines.join("\n")}`;
}
