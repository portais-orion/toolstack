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

test("Skills view exposes onboarding action hooks", () => {
  const html = fs.readFileSync("index.html", "utf8");
  for (const id of ["installSkillsBtn", "skillsGuideBtn", "skillsGithubBtn", "skillsGuideView", "skillsGuideContent"]) {
    assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
  }
});

test("app exposes guide loading and deep-link handlers", () => {
  const app = fs.readFileSync("app.js", "utf8");
  for (const hook of ["orion-skills-guide.json", "renderSkillsGuide", "openInstallModal", "openSkillDetail", "skills/guia", "skill/"]) {
    assert.ok(app.includes(hook), `missing ${hook}`);
  }
});

test("guide has dedicated responsive style hooks", () => {
  const css = fs.readFileSync("styles.css", "utf8");
  for (const hook of [".skills-actions", ".skills-guide-view", ".guide-command", ".guide-source-grid", ".skill-detail"]) {
    assert.ok(css.includes(hook), `missing ${hook}`);
  }
  assert.match(css, /@media[^{]+\{[\s\S]*\.skills-actions/);
});
