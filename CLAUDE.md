# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static site (no build step, no framework, no backend) cataloging tools, technologies and services used across the Orion group's projects (Superterminais, SuperTrans, Aurora EADI). Published to GitHub Pages. Only external deps are Google Fonts (Inter) and Simple Icons CDN, both degrade gracefully.

## Commands

```bash
# Serve locally — required because index.html uses fetch("tools.json"), which fails under file://
python3 -m http.server 8080
# or
npx serve .

# Validate the dataset (also runs in CI before every deploy)
node validate.js
```

There is no test suite, no linter, no package.json — `validate.js` (plain Node, no deps) is the only automated check: JSON parses, required fields present (`id`/`name`/`category` on tools, `id`/`name`/`company` on systems), no duplicate ids, and every `toolIds` reference in `systems.json` resolves to a real tool.

Deploy is automatic: any push to `main` runs `.github/workflows/deploy.yml`, which runs `node validate.js`, copies the public files into `dist/`, and publishes to GitHub Pages.

## Architecture

Everything lives in three top-level files plus two JSON data sources — there is no bundler, no modules, no npm install:

- `index.html` — page structure/markup only.
- `styles.css` — all styling, design tokens, light/dark theme variables.
- `app.js` — all frontend logic (vanilla JS, IIFE, no imports). ~1100 lines, one file.
- `tools.json` — the tools/technologies dataset (source of truth for the Ferramentas view).
- `systems.json` — the systems/products dataset (source of truth for the Sistemas view). Each system's `toolIds` array references `tools.json` ids.

### Three views, one page

The UI is a single page with three views toggled by tab + URL hash (`#tools` / `#systems` / `#matrix`), driven by `route()` / `setView()` in `app.js`:

- **Ferramentas** (`renderTools`) — card catalog with category sidebar, search, sort by usage-count or alphabetical.
- **Sistemas** (`renderSystems`) — Orion group products grouped/filterable by company, each with objective, platform, architecture, stack highlights, and full tool list.
- **Matriz** (`renderMatrix`, `renderMatrixCards`, `renderMatrixCompare`) — side-by-side technology comparison table/cards across systems, grouped by architectural category, with export.

Views are cross-linked: a technology chip inside a system or the matrix jumps to that tool filtered in Ferramentas (`jumpToTool`); a project tag inside a tool's modal jumps to the owning system, expanded and highlighted (`jumpToSystem`). The project→system mapping lives in the `PROJ2SYS` object near the top of `app.js` — **must be updated by hand** whenever a system's `repoPath` folder name changes or a new system is added, it is not derived from `systems.json`.

### Key conventions in `app.js`

- `mountLogo()` / `hue()` — logo `<img>` with an `onerror` fallback to a deterministic colored monogram (hash of the tool name → hue). Never handle broken logos manually in data; this is automatic.
- `PLAT` — maps `platform` values (`"web"`, `"mobile"`, `"web-mobile"`) to their badge icon/label. Add new platform values here.
- Command palette (`openPal`, `palRender`, `palHi`) — global fuzzy search/action menu, also renders system rows via `row()`.
- Deep linking: `#tool/<id>` and `#system/<id>` hashes, plus "Copiar link" buttons, handled in `route()`.
- Theme (light/dark) toggled in header, persisted to `localStorage`, dark is default.

### Data model rules

- Every `tools.json` entry needs a unique kebab-case `id`; referenced by `systems.json[].toolIds` and by `tools.json[].projects` (folder names, keyed against `PROJ2SYS`).
- Categories are **not** an enum anywhere — they're inferred at render time from whatever `category` strings appear in `tools.json`. Adding a new category is just using a new string.
- `logo` should point at a Simple Icons CDN URL (`https://cdn.simpleicons.org/<slug>/<hex>`), an official asset, or Devicon; a locally-stored logo goes in `assets/logos/` (create if absent) and is referenced by relative path. A missing/broken logo is fine — it falls back automatically, no need to guard for it in data.
- `usage` fields must reflect real evidence found in the actual project repos (package.json, lockfiles, Dockerfiles, CI configs, `.env.example`, READMEs) — do not invent usage. See README's "Metodologia de catalogação" for which project repos were analyzed.
- After editing either JSON file, run `node validate.js` before committing.
