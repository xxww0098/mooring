import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAttachmentPrompt,
  isImageMime,
  mergeAttachments,
  safeFileName,
  type ComposerAttachment,
} from "./composer-media.ts";

test("image mime and names", () => {
  assert.equal(isImageMime("image/png"), true);
  assert.equal(isImageMime("", "shot.WEBP"), true);
  assert.equal(isImageMime("application/pdf", "spec.pdf"), false);
});

test("prompt lists workspace paths", () => {
  const prompt = buildAttachmentPrompt("看看这张图", [
    {
      id: "a",
      kind: "image",
      name: "ui.png",
      mime: "image/png",
      size: 12,
      relPath: "attachments/f_1-ui.png",
    },
  ]);
  assert.match(prompt, /看看这张图/);
  assert.match(prompt, /attachments\/f_1-ui\.png/);
  assert.equal(buildAttachmentPrompt("  ", []).trim(), "");
});

test("merge rejects oversized and caps count", () => {
  const item = (id: string, size = 10): ComposerAttachment => ({
    id,
    kind: "file",
    name: `${id}.txt`,
    mime: "text/plain",
    size,
    relPath: `attachments/${id}.txt`,
    base64: "",
  });
  const over = mergeAttachments([], [item("big", 13 * 1024 * 1024)]);
  assert.equal(over.next.length, 0);
  assert.ok(over.error);
  const many = mergeAttachments(
    Array.from({ length: 8 }, (_, i) => item(`n${i}`)),
    [item("extra")],
  );
  assert.equal(many.next.length, 8);
  assert.ok(many.error);
});

test("safe names drop path separators", () => {
  assert.equal(safeFileName("../../a b.png"), "a b.png");
});
