import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("guide has verified sections, commands, and sources", () => {
  const guide = JSON.parse(fs.readFileSync("orion-skills-guide.json", "utf8"));
  assert.ok(Array.isArray(guide.commands));
  assert.ok(guide.commands.some((x) => x.command === "npx @portais-orion/skills@latest"));
  assert.ok(guide.commands.some((x) => x.command.endsWith(" doctor")));
  assert.equal(guide.sources.length, 3);
  assert.ok(guide.promptExamples.length >= 4);
});
