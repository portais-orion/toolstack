# Orion Agent Skills Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing Skills view into a lightweight installation and usage onboarding hub while preserving its current catalog and visual language.

**Architecture:** Keep the vanilla SPA and hash router. Load tutorial content from `orion-skills-guide.json`, keep skill metadata in `orion-skills.json`, and reuse the existing sheet/modal overlay for installation and skill details. Add `#skills/guia` and `#skill/<name>` without adding a framework, build step, or browser-side CLI execution.

**Tech Stack:** Vanilla HTML5, CSS3 custom properties, ES6 JavaScript in the existing IIFE, static JSON, Node.js built-in test/assert APIs.

**Spec:** `docs/superpowers/specs/2026-09-02-orion-skills-onboarding-design.md`

## Global Constraints

- Preserve the current identity, header, typography, cards, filters, grouping, responsive behavior, and dark/light themes.
- Use only commands documented in `C:\projetos\orion-skills-cli\README.md`; the install command is `npx @portais-orion/skills@latest`.
- Keep installation global for the user, targeting Claude Code and Codex; the browser never executes the CLI.
- Do not duplicate complete `SKILL.md` content or invent per-skill standards metadata.
- Escape dynamic content or assign it through `textContent` before DOM insertion.
- Run `node --check app.js`, `node --test tests/skills-onboarding-contract.test.mjs`, `node validate.js`, and `git diff --check` before completion.

## Files

- Create `orion-skills-guide.json`: verified tutorial sections, sources, commands, prompts, troubleshooting, and FAQ.
- Create `tests/skills-onboarding-contract.test.mjs`: dependency-free checks for guide/source parity, markup hooks, routes, and styles.
- Modify `index.html`: Skills CTAs and guide view markup.
- Modify `app.js`: guide loading/rendering, CTA actions, copy interactions, detail modal, and route handling.
- Modify `styles.css`: CTA, guide, command, source, callout, modal, and responsive styles.
- Modify `validate.js`: parse and validate the guide dataset and print its counts.

### Task 1: Tutorial data and validator

**Files:**
- Create: `orion-skills-guide.json`
- Create: `tests/skills-onboarding-contract.test.mjs`
- Modify: `validate.js`

**Interfaces:**
- Guide object fields: `intro`, `prerequisites`, `sources`, `commands`, `promptExamples`, `troubleshooting`, `faq`.
- Command: `{ command, label, description }`.
- Source: `{ name, repo, description }`.
- Prompt: `{ prompt, skill }`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run and observe the expected failure**

Run `node --test tests/skills-onboarding-contract.test.mjs`; it fails because the guide file is absent.

- [ ] **Step 3: Add guide data from the CLI README**

Include exact commands: base, `install`, `update`, `list`, `list --json`, `sources`, `doctor`. Include the three registry sources, real prerequisites, five contextual prompts, troubleshooting, and FAQ.

- [ ] **Step 4: Extend `validate.js`**

Parse the guide, require every section, validate command/source/prompt fields, reject duplicate commands, and reject prompt skills not present in `orion-skills.json`. Print guide section and command totals.

- [ ] **Step 5: Run green checks and commit**

Run `node --test tests/skills-onboarding-contract.test.mjs` and `node validate.js`; both must pass. Commit:

```bash
git add orion-skills-guide.json tests/skills-onboarding-contract.test.mjs validate.js
git commit -m "feat: adiciona dados do guia de skills"
```

### Task 2: Markup for tabs and guide view

**Files:**
- Modify: `index.html`
- Test: `tests/skills-onboarding-contract.test.mjs`

**Interfaces:** IDs `skillsViewTabs`, `skillsCatalogTab`, `skillsGuideTab`, `skillsGuideView`, and `skillsGuideContent` are stable hooks consumed by `app.js`.

- [ ] **Step 1: Add failing markup assertions**

Assert each ID and the Skills CTA labels exist in `index.html`; run the test and observe failure.

- [ ] **Step 2: Add tabs and guide markup**

Put `Catálogo` and `Guia de uso` role tabs below the Skills hero, with a discreet GitHub text link. Add a hidden-by-view guide section with a back action and empty `skillsGuideContent`; retain the catalog markup.

- [ ] **Step 3: Run the contract test and commit**

Run `node --test tests/skills-onboarding-contract.test.mjs`; expect PASS. Commit `git add index.html tests/skills-onboarding-contract.test.mjs && git commit -m "feat: adiciona onboarding à área de skills"`.

### Task 3: Routing, rendering, and modal interactions

**Files:**
- Modify: `app.js`
- Test: `tests/skills-onboarding-contract.test.mjs`

**Interfaces:** Add `S.skillsGuide`, `renderSkillsGuide()`, `openInstallModal()`, and `openSkillDetail(skill)`. Routes: `#skills`, `#skills/guia`, and `#skill/<name>`.

- [ ] **Step 1: Add failing route assertions**

Assert the app contains the guide fetch, the three functions, and both deep-link branches; run the test and observe failure.

- [ ] **Step 2: Load guide and toggle views**

Fetch `orion-skills-guide.json` in the existing `Promise.all`; render guide after initialization; handle `#skills/guia` before generic `#skills`; toggle header aria state and close overlays on view changes.

- [ ] **Step 3: Implement guide rendering and skill detail**

Render all guide sections from JSON, including the installation command and its copy action. Make catalog cards open `#skill/<name>` and a detail sheet containing name, area, description, source link, and matching prompt example. Use `textContent` for dynamic fields; ESC/backdrop closes and returns to the prior hash.

- [ ] **Step 4: Bind tabs and verify**

Bind tabs, back action, copy buttons, and route transitions. Run `node --check app.js` and the contract test; expect PASS. Commit `git add app.js tests/skills-onboarding-contract.test.mjs && git commit -m "feat: implementa guia e deep links das skills"`.

### Task 4: Visual styling

**Files:**
- Modify: `styles.css`
- Test: `tests/skills-onboarding-contract.test.mjs`

**Interfaces:** Add `.skills-local-nav`, `.skills-guide-view`, `.guide-section`, `.guide-command`, `.guide-source-grid`, `.guide-callout`, `.guide-faq`, and `.skill-detail` using existing CSS variables.

- [ ] **Step 1: Add failing style assertions**

Assert the class hooks and a mobile `.skills-local-nav` rule; run the test and observe failure.

- [ ] **Step 2: Style desktop and mobile states**

Match current surfaces, borders, type scale, shadows, and accent tokens. Stack CTAs below 620px; make command blocks scroll safely; keep dark/light contrast and modal readability.

- [ ] **Step 3: Verify and commit**

Run `node --test tests/skills-onboarding-contract.test.mjs` and `git diff --check`; expect PASS. Commit `git add styles.css tests/skills-onboarding-contract.test.mjs && git commit -m "style: finaliza interface do guia de skills"`.

### Task 5: End-to-end handoff

**Files:** none unless a verification defect requires a focused fix.

- [ ] **Step 1: Run complete checks**

```bash
node --check app.js
node --test tests/skills-onboarding-contract.test.mjs
node validate.js
git diff --check
```

All commands must exit 0; validator reports 85 tools, 7 systems, 26 Orion Agent Skills, and guide totals.

- [ ] **Step 2: Smoke-test the static site**

Run `python -m http.server 8080` and inspect `#skills`, `#skills/guia`, and `#skill/orion-security`: cards, guide, install modal, copy buttons, back navigation, ESC/backdrop, and both themes.

- [ ] **Step 3: Inspect status**

Run `git status --short` and `git log -5 --oneline`; only planned files may be changed.
