import assert from "node:assert/strict";
import test from "node:test";
import { buildRefPrompt, mergeRefs, promoteCompletedRefs, makeRef } from "./composer-ref.ts";

test("promote completed file mention and leave incomplete @", () => {
  const done = promoteCompletedRefs("see @Welcome.md please", ["Welcome.md", "Daily/Today.md"], ["compact"], false);
  assert.equal(done.refs[0]?.value, "Welcome.md");
  assert.equal(done.refs[0]?.kind, "file");
  assert.equal(done.text.includes("@Welcome.md"), false);
  const typing = promoteCompletedRefs("@Wel", ["Welcome.md"], [], true);
  assert.equal(typing.refs.length, 0);
  assert.equal(typing.text, "@Wel");
});

test("promote skill tokens and skip duplicates", () => {
  const pulled = promoteCompletedRefs("@compact ", [], ["compact"], false);
  assert.equal(pulled.refs[0]?.kind, "skill");
  const merged = mergeRefs(pulled.refs, [makeRef("skill", "compact")]);
  assert.equal(merged.length, 1);
});

test("ref prompt lists notes and skills", () => {
  const prompt = buildRefPrompt("改这一页", [
    makeRef("file", "Welcome.md", "Welcome.md"),
    makeRef("skill", "compact", "compact"),
  ]);
  assert.match(prompt, /Welcome\.md/);
  assert.match(prompt, /技能 compact/);
});
