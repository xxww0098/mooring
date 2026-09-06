import { uid } from "../utils.ts";

export const MAX_ATTACHMENTS = 8;
export const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;

export type ComposerAttachment = {
  id: string;
  kind: "image" | "file";
  name: string;
  mime: string;
  size: number;
  relPath: string;
  preview?: string;
  base64: string;
};

export type ChatAttachment = Omit<ComposerAttachment, "base64">;

const IMAGE_MIME = /^(image\/(png|jpe?g|gif|webp|bmp|svg\+xml))$/i;

export function isImageMime(mime: string, name = ""): boolean {
  if (IMAGE_MIME.test(mime)) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / (1024 * 102.4)) / 10} MB`;
}

export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  return (base.replace(/[?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim() || "file").slice(0, 80);
}

export function attachmentRelPath(name: string): string {
  return `attachments/${uid("f")}-${safeFileName(name)}`;
}

export function buildAttachmentPrompt(text: string, attachments: ChatAttachment[]): string {
  const body = text.trim();
  if (attachments.length === 0) return body;
  const lines = attachments.map((item) => {
    const kind = item.kind === "image" ? "image" : "file";
    return `- ${item.relPath} (${kind}, ${item.name})`;
  });
  const header = body || "请查看附件。";
  return `${header}\n\n附件（工作区路径，请直接读取）：\n${lines.join("\n")}`;
}

export function mergeAttachments(
  current: ComposerAttachment[],
  incoming: ComposerAttachment[],
): { next: ComposerAttachment[]; error: string | null } {
  const next = [...current];
  for (const item of incoming) {
    if (item.size > MAX_ATTACHMENT_BYTES) {
      return { next: current, error: `${item.name} 超过 12MB` };
    }
    if (next.length >= MAX_ATTACHMENTS) {
      return { next, error: `最多 ${MAX_ATTACHMENTS} 个附件` };
    }
    if (next.some((row) => row.id === item.id)) continue;
    next.push(item);
  }
  return { next, error: null };
}

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function fileToAttachment(file: File): Promise<ComposerAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const image = isImageMime(file.type, file.name);
      resolve({
        id: uid("att"),
        kind: image ? "image" : "file",
        name: file.name || (image ? "image.png" : "file"),
        mime: file.type || (image ? "image/png" : "application/octet-stream"),
        size: file.size,
        relPath: attachmentRelPath(file.name || "file"),
        preview: image ? dataUrl : undefined,
        base64: dataUrlToBase64(dataUrl),
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export async function filesToAttachments(files: Iterable<File>): Promise<ComposerAttachment[]> {
  const list = [...files].filter((file) => file && file.size > 0);
  return Promise.all(list.map(fileToAttachment));
}

export function clipboardToFiles(clipboard: DataTransfer | null): File[] {
  if (!clipboard) return [];
  const fromList = [...clipboard.files];
  if (fromList.length) return fromList;
  const out: File[] = [];
  for (const item of clipboard.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) out.push(file);
  }
  return out;
}

export function toChatAttachment(item: ComposerAttachment): ChatAttachment {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    mime: item.mime,
    size: item.size,
    relPath: item.relPath,
    preview: item.preview,
  };
}
