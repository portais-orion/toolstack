const fs = require("fs");
const path = require("path");

// Allowed values for the optional 'layer' field in tools.json
const VALID_LAYERS = [
  "Frontend",
  "Backend",
  "Mobile",
  "Database",
  "DevOps & Infra",
  "Observabilidade",
  "Autenticação & Segurança",
  "Testes & QA",
  "Utilitários",
  "Inteligência Artificial",
];

function run() {
  console.log("🔍 Validating toolstack dataset...\n");
  let errors = [];
  let warnings = [];

  const toolsPath = path.join(__dirname, "tools.json");
  const systemsPath = path.join(__dirname, "systems.json");

  let tools = [];
  let systems = [];

  // 1. Parse tools.json
  try {
    const rawTools = fs.readFileSync(toolsPath, "utf8");
    tools = JSON.parse(rawTools);
    if (!Array.isArray(tools)) {
      errors.push("tools.json must contain an array of objects.");
    }
  } catch (err) {
    errors.push(`Failed to parse tools.json: ${err.message}`);
  }

  // 2. Parse systems.json
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

  // 3. Validate tools
  const toolIds = new Set();
  tools.forEach((tool, index) => {
    const pos = `tools.json[${index}] (${tool.name || "unnamed"})`;

    // Required fields
    if (!tool.id) {
      errors.push(`${pos} is missing required field 'id'.`);
    } else if (toolIds.has(tool.id)) {
      errors.push(`Duplicate tool id '${tool.id}' found at ${pos}.`);
    } else {
      toolIds.add(tool.id);
    }
    if (!tool.name) errors.push(`${pos} is missing required field 'name'.`);
    if (!tool.category) errors.push(`${pos} is missing required field 'category'.`);

    // URL format checks
    if (tool.link && !/^https?:\/\//i.test(tool.link)) {
      warnings.push(`${pos} field 'link' does not start with http:// or https://: "${tool.link}"`);
    }
    if (tool.logo && !/^https?:\/\//i.test(tool.logo) && !/^assets\//i.test(tool.logo)) {
      warnings.push(`${pos} field 'logo' is not a valid HTTP URL or local assets path: "${tool.logo}"`);
    }

    // Optional: layer (enum)
    if (tool.layer !== undefined) {
      if (typeof tool.layer !== "string") {
        errors.push(`${pos} field 'layer' must be a string.`);
      } else if (!VALID_LAYERS.includes(tool.layer)) {
        errors.push(
          `${pos} field 'layer' has invalid value "${tool.layer}". Allowed: ${VALID_LAYERS.join(", ")}.`
        );
      }
    }

    // Optional: version (string)
    if (tool.version !== undefined && typeof tool.version !== "string") {
      errors.push(`${pos} field 'version' must be a string.`);
    }

    // Optional: tags (array of strings)
    if (tool.tags !== undefined) {
      if (!Array.isArray(tool.tags)) {
        errors.push(`${pos} field 'tags' must be an array.`);
      } else {
        tool.tags.forEach((tag, ti) => {
          if (typeof tag !== "string") {
            errors.push(`${pos} field 'tags[${ti}]' must be a string.`);
          }
        });
      }
    }
  });

  // 4. Validate systems
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

    // Cross-reference toolIds
    if (Array.isArray(sys.toolIds)) {
      sys.toolIds.forEach((tId) => {
        if (!toolIds.has(tId)) {
          warnings.push(
            `System '${sys.name}' (${sys.id}) references unknown toolId '${tId}' (not found in tools.json).`
          );
        }
      });
    }

    // Optional: tags (array of strings)
    if (sys.tags !== undefined) {
      if (!Array.isArray(sys.tags)) {
        errors.push(`${pos} field 'tags' must be an array.`);
      } else {
        sys.tags.forEach((tag, ti) => {
          if (typeof tag !== "string") {
            errors.push(`${pos} field 'tags[${ti}]' must be a string.`);
          }
        });
      }
    }
  });

  // Report
  const layerCoverage = tools.filter((t) => t.layer).length;
  const versionCoverage = tools.filter((t) => t.version).length;

  console.log(`📊 Statistics:`);
  console.log(`  - Tools: ${tools.length}`);
  console.log(`  - Systems: ${systems.length}`);
  console.log(`  - Tools with 'layer': ${layerCoverage}/${tools.length}`);
  console.log(`  - Tools with 'version': ${versionCoverage}/${tools.length}\n`);

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
