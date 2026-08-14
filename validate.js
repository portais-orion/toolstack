const fs = require("fs");
const path = require("path");

function run() {
  console.log("🔍 Validating toolstack dataset...\n");
  let errors = [];
  let warnings = [];

  const toolsPath = path.join(__dirname, "tools.json");
  const systemsPath = path.join(__dirname, "systems.json");

  let tools = [];
  let systems = [];

  // 1. Validate tools.json
  try {
    const rawTools = fs.readFileSync(toolsPath, "utf8");
    tools = JSON.parse(rawTools);
    if (!Array.isArray(tools)) {
      errors.push("tools.json must contain an array of objects.");
    }
  } catch (err) {
    errors.push(`Failed to parse tools.json: ${err.message}`);
  }

  // 2. Validate systems.json
  try {
    const rawSystems = fs.readFileSync(systemsPath, "utf8");
    systems = JSON.parse(rawSystems);
    if (!Array.isArray(systems)) {
      errors.push("systems.json must contain an array of objects.");
    }
  } catch (err) {
    errors.push(`Failed to parse systems.json: ${err.message}`);
  }

  if (errors.length > 0) {
    console.error("❌ Fatal JSON syntax errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // 3. Check tools IDs and fields
  const toolIds = new Set();
  tools.forEach((tool, index) => {
    const pos = `tools.json[${index}] (${tool.name || "unnamed"})`;
    if (!tool.id) {
      errors.push(`${pos} is missing required field 'id'.`);
    } else if (toolIds.has(tool.id)) {
      errors.push(`Duplicate tool id '${tool.id}' found at ${pos}.`);
    } else {
      toolIds.add(tool.id);
    }

    if (!tool.name) errors.push(`${pos} is missing required field 'name'.`);
    if (!tool.category) errors.push(`${pos} is missing required field 'category'.`);
  });

  // 4. Check systems IDs and cross-reference toolIds
  const systemIds = new Set();
  systems.forEach((sys, index) => {
    const pos = `systems.json[${index}] (${sys.name || "unnamed"})`;
    if (!sys.id) {
      errors.push(`${pos} is missing required field 'id'.`);
    } else if (systemIds.has(sys.id)) {
      errors.push(`Duplicate system id '${sys.id}' found at ${pos}.`);
    } else {
      systemIds.add(sys.id);
    }

    if (!sys.name) errors.push(`${pos} is missing required field 'name'.`);
    if (!sys.company) errors.push(`${pos} is missing required field 'company'.`);

    if (Array.isArray(sys.toolIds)) {
      sys.toolIds.forEach((tId) => {
        if (!toolIds.has(tId)) {
          warnings.push(
            `System '${sys.name}' (${sys.id}) references unknown toolId '${tId}' (not found in tools.json).`
          );
        }
      });
    }
  });

  // Report
  console.log(`📊 Statistics:`);
  console.log(`  - Tools: ${tools.length}`);
  console.log(`  - Systems: ${systems.length}\n`);

  if (warnings.length > 0) {
    console.warn(`⚠️ Warnings (${warnings.length}):`);
    warnings.forEach((w) => console.warn(`  - ${w}`));
    console.log();
  }

  if (errors.length > 0) {
    console.error(`❌ Validation failed with ${errors.length} error(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log("✅ All dataset validations passed successfully!");
}

run();
