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
  const skillsPath = path.join(__dirname, "orion-skills.json");
  const guidePath = path.join(__dirname, "orion-skills-guide.json");

  let tools = [];
  let systems = [];
  let skills = [];
  let guide = {};

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

  // 3. Parse Orion Agent Skills
  try {
    const rawSkills = fs.readFileSync(skillsPath, "utf8");
    skills = JSON.parse(rawSkills);
    if (!Array.isArray(skills)) {
      errors.push("orion-skills.json must contain an array of objects.");
    }
  } catch (err) {
    errors.push(`Failed to parse orion-skills.json: ${err.message}`);
  }

  // 4. Parse Orion Agent Skills guide
  try {
    const rawGuide = fs.readFileSync(guidePath, "utf8");
    guide = JSON.parse(rawGuide);
    if (!guide || Array.isArray(guide) || typeof guide !== "object") {
      errors.push("orion-skills-guide.json must contain an object.");
    }
  } catch (err) {
    errors.push(`Failed to parse orion-skills-guide.json: ${err.message}`);
  }

  if (errors.length > 0) {
    console.error("❌ Fatal JSON syntax errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // 5. Validate tools
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

  // 6. Validate systems
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

  // 7. Validate Orion Agent Skills
  const skillNames = new Set();
  skills.forEach((skill, index) => {
    const pos = `orion-skills.json[${index}] (${skill.name || "unnamed"})`;

    if (!skill.category) errors.push(`${pos} is missing required field 'category'.`);
    if (!skill.name) {
      errors.push(`${pos} is missing required field 'name'.`);
    } else if (skillNames.has(skill.name)) {
      errors.push(`Duplicate skill name '${skill.name}' found at ${pos}.`);
    } else {
      skillNames.add(skill.name);
    }
    if (!skill.description) errors.push(`${pos} is missing required field 'description'.`);
  });

  // 8. Validate Orion Agent Skills guide
  ["intro", "prerequisites", "sources", "commands", "promptExamples", "troubleshooting", "faq"].forEach((field) => {
    if (guide[field] === undefined) errors.push(`orion-skills-guide.json is missing required field '${field}'.`);
  });
  if (typeof guide.intro !== "string" || !guide.intro.trim()) {
    errors.push("orion-skills-guide.json field 'intro' must be a non-empty string.");
  }
  ["prerequisites", "sources", "commands", "promptExamples", "troubleshooting", "faq"].forEach((field) => {
    if (guide[field] !== undefined && !Array.isArray(guide[field])) {
      errors.push(`orion-skills-guide.json field '${field}' must be an array.`);
    }
  });
  const guideCommands = new Set();
  (guide.commands || []).forEach((command, index) => {
    const pos = `orion-skills-guide.json.commands[${index}]`;
    if (!command || typeof command !== "object") {
      errors.push(`${pos} must be an object.`);
      return;
    }
    ["command", "label", "description"].forEach((field) => {
      if (typeof command[field] !== "string" || !command[field].trim()) errors.push(`${pos} is missing required field '${field}'.`);
    });
    if (command.command && guideCommands.has(command.command)) errors.push(`Duplicate guide command '${command.command}'.`);
    if (command.command) guideCommands.add(command.command);
  });
  (guide.sources || []).forEach((source, index) => {
    const pos = `orion-skills-guide.json.sources[${index}]`;
    ["name", "repo", "description"].forEach((field) => {
      if (!source || typeof source[field] !== "string" || !source[field].trim()) errors.push(`${pos} is missing required field '${field}'.`);
    });
  });
  (guide.promptExamples || []).forEach((example, index) => {
    const pos = `orion-skills-guide.json.promptExamples[${index}]`;
    if (!example || typeof example.prompt !== "string" || !example.prompt.trim()) errors.push(`${pos} is missing required field 'prompt'.`);
    if (!example || typeof example.skill !== "string" || !skillNames.has(example.skill)) errors.push(`${pos} references unknown skill '${example && example.skill ? example.skill : ""}'.`);
  });

  // Report
  const layerCoverage = tools.filter((t) => t.layer).length;
  const versionCoverage = tools.filter((t) => t.version).length;

  console.log(`📊 Statistics:`);
  console.log(`  - Tools: ${tools.length}`);
  console.log(`  - Systems: ${systems.length}`);
  console.log(`  - Orion Agent Skills: ${skills.length}`);
  console.log(`  - Guide sections: 7`);
  console.log(`  - Guide commands: ${(guide.commands || []).length}`);
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
