import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Pages artifact includes every runtime JSON dataset", () => {
  const workflow = fs.readFileSync(".github/workflows/deploy.yml", "utf8");
  for (const file of ["tools.json", "systems.json", "orion-skills.json", "orion-skills-guide.json"]) {
    assert.match(workflow, new RegExp(`cp ${file.replace(".", "\\.")} dist/`), `missing ${file} in Pages artifact`);
  }
});
