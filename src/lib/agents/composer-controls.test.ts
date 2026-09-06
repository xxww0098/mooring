import assert from "node:assert/strict";
import test from "node:test";
import {
  composerFamilies,
  formatModelChip,
  resolveEffort,
  resolveFamily,
  thinkingCommand,
} from "./composer-controls.ts";
import { parseGrokModelsOutput } from "./models-catalog.ts";

test("grok catalog is 4.6 + 4.5 with per-model effort from models.dev", () => {
  const families = composerFamilies("grok");
  assert.deepEqual(
    families.map((item) => item.id),
    ["grok-4.6", "grok-4.5"],
  );
  const family = resolveFamily(families, "grok-4.6");
  assert.ok(family);
  assert.equal(family.label, "Grok 4.6");
  assert.deepEqual(
    family.efforts.map((item) => item.id),
    ["low", "medium", "high", "xhigh"],
  );
  assert.equal(formatModelChip(family, "xhigh"), "Grok 4.6 Xhigh");
  assert.equal(thinkingCommand("grok", "xhigh"), "/effort xhigh");
  assert.equal(
    families.some((item) => item.id === "grok-4" || item.id === "grok-code"),
    false,
  );
});

test("unsupported effort snaps to family default", () => {
  const family = resolveFamily(composerFamilies("grok"), "grok-4.5");
  assert.ok(family);
  assert.equal(resolveEffort(family, "xhigh"), "high");
});

test("parse grok models text and json", () => {
  assert.deepEqual(
    parseGrokModelsOutput(`Default model: grok-4.6
Available models:
* grok-4.6 (default)
- grok-4.5
- grok-composer-2.5-fast`),
    ["grok-4.6", "grok-4.5", "grok-composer-2.5-fast"],
  );
  assert.deepEqual(
    parseGrokModelsOutput(JSON.stringify({ models: [{ id: "grok-4.6" }, { id: "grok-4.5" }] })),
    ["grok-4.6", "grok-4.5"],
  );
});

test("claude aliases keep max effort; agents without a catalog stay empty", () => {
  const opus = resolveFamily(composerFamilies("claude"), "opus");
  assert.ok(opus?.efforts.some((item) => item.id === "max"));
  assert.equal(opus?.label, "Opus 5");
  assert.equal(composerFamilies("aider").length, 0);
});
