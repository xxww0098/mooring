import { Fragment, type ReactNode } from "react";

function inline(text: string, onOpen: (path: string) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern =
    /(\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      const path = match[2].trim();
      const label = (match[3] ?? path).trim();
      const href = path.endsWith(".md") ? path : `${path}.md`;
      parts.push(
        <button
          key={`w${key++}`}
          type="button"
          className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          onClick={() => onOpen(href)}
        >
          {label}
        </button>,
      );
    } else if (match[4]) {
      parts.push(
        <code
          key={`c${key++}`}
          className="rounded-xs bg-elevated px-1 py-px font-mono text-[0.85em] text-fg"
        >
          {match[4]}
        </code>,
      );
    } else if (match[5]) {
      parts.push(<strong key={`b${key++}`}>{match[5]}</strong>);
    } else if (match[6]) {
      parts.push(<em key={`i${key++}`}>{match[6]}</em>);
    } else if (match[7] && match[8]) {
      parts.push(
        <a
          key={`a${key++}`}
          href={match[8]}
          className="text-accent underline decoration-accent/40 underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          {match[7]}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownView({
  source,
  onOpen,
}: {
  source: string;
  onOpen: (path: string) => void;
}) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const fence: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        fence.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={`pre${key++}`}
          className="overflow-x-auto rounded-md bg-elevated p-3 font-mono text-sm leading-relaxed text-fg"
        >
          <code>{fence.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#{1,3}\s/, "");
      const cls =
        level === 1
          ? "font-serif text-2xl font-semibold tracking-tight text-fg"
          : level === 2
            ? "font-serif text-xl font-semibold tracking-tight text-fg"
            : "text-lg font-medium text-fg";
      const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1";
      blocks.push(
        <Tag key={`h${key++}`} className={`${cls} mt-6 first:mt-0`}>
          {inline(text, onOpen)}
        </Tag>,
      );
      i += 1;
      continue;
    }

    if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const items: string[] = [];
      const ordered = /^\d+\.\s/.test(line);
      while (
        i < lines.length &&
        (ordered ? /^\d+\.\s/.test(lines[i]) : /^[-*]\s/.test(lines[i]))
      ) {
        items.push(lines[i].replace(/^([-*]|\d+\.)\s/, ""));
        i += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List
          key={`l${key++}`}
          className={`my-3 space-y-1 pl-5 text-[15px] leading-relaxed text-fg ${
            ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {items.map((item, idx) => (
            <li key={idx}>{inline(item, onOpen)}</li>
          ))}
        </List>,
      );
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !lines[i].startsWith("```")
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p${key++}`} className="my-3 text-[15px] leading-7 text-fg">
        {para.map((piece, idx) => (
          <Fragment key={idx}>
            {idx > 0 ? " " : null}
            {inline(piece, onOpen)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="max-w-[46rem]">{blocks}</div>;
}
