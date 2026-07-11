# User-Focused README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the root README into a concise ordinary-user entry point and move developer-oriented guidance into a dedicated document.

**Architecture:** `README.md` will contain only product-facing information, first-run instructions, basic usage, document links, sponsorship, and licensing. `docs/DEVELOPMENT.md` will become the developer entry point and link to the existing detailed architecture documents rather than duplicating them.

**Tech Stack:** Markdown, npm scripts, shell-based link verification

---

### Task 1: Create the developer documentation entry point

**Files:**
- Create: `docs/DEVELOPMENT.md`
- Reference: `package.json`
- Reference: `docs/architecture/current-architecture.md`
- Reference: `docs/panel-architecture.md`

- [ ] **Step 1: Add development setup and commands**

Create `docs/DEVELOPMENT.md` with the required Node.js/npm setup, the exact development, testing, building, and landing-site commands currently declared in `package.json`.

- [ ] **Step 2: Add the project structure overview**

Document the responsibilities of `src/main/`, `src/preload/`, `src/renderer/pet/`, `src/renderer/panel/`, `src/shared/`, `landing/`, `tests/`, and `docs/` without reproducing file-by-file implementation detail.

- [ ] **Step 3: Add architecture and workflow links**

Summarize the three-process Electron boundary, config update flow, Petpack flow, and rule execution flow in compact form. Link to `architecture/current-architecture.md`, `panel-architecture.md`, `stateful-rules-design.md`, `superpowers/specs/2026-07-08-animation-queue-design.md`, and `release/client-release-checklist.md` for details.

- [ ] **Step 4: Check the new document headings**

Run:

```bash
rg '^#{1,3} ' docs/DEVELOPMENT.md
```

Expected: one H1 followed by clearly ordered H2 sections for setup, commands, structure, architecture, workflows, testing, and related documents.

### Task 2: Rewrite README for ordinary users

**Files:**
- Modify: `README.md`
- Reference: `docs/USER_GUIDE.md`
- Reference: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Replace technical feature descriptions with user benefits**

Keep the cover and introductory paragraph, then describe the visible capabilities: desktop pet interaction, Petpack import/export, configurable animations and rules, control panel, immediate updates, bilingual UI, and local storage/security.

- [ ] **Step 2: Add concise first-run and basic-use instructions**

Keep `npm install` and `npm run dev`. Explain how to open the control panel, import a Petpack, configure animations/rules, and adjust display/system settings. Link package-creation details to `docs/USER_GUIDE.md`.

- [ ] **Step 3: Reduce commands and replace implementation sections with navigation**

Show only the primary development, test, build, and package commands. Remove the expanded Electron, manifest, animation queue, rule engine, panel architecture, safety implementation, storage path, and landing architecture sections. Add separate user and developer document lists, including `docs/DEVELOPMENT.md`.

- [ ] **Step 4: Preserve sponsorship and licensing**

Retain `docs/sponsor-author.png`, the 爱发电 URL, the QR-code explanation, and the GPL-3.0 `LICENSE` link.

- [ ] **Step 5: Check README size and headings**

Run:

```bash
wc -l README.md
rg '^#{1,3} ' README.md
```

Expected: approximately 100–130 lines, with a single H1 and a short sequence of user-oriented H2 sections.

### Task 3: Verify links and scope

**Files:**
- Verify: `README.md`
- Verify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Validate local Markdown links**

Run a read-only script that extracts non-HTTP Markdown link targets from both files, resolves anchors and relative paths from each document's directory, and reports missing files.

Expected: `missing links: 0`.

- [ ] **Step 2: Confirm technical details were removed from README**

Run:

```bash
rg -n 'Electron 运行模型|schemaVersion|pending 槽位|conditionWindowMs|Context Isolation|config.json' README.md
```

Expected: no matches.

- [ ] **Step 3: Review the focused diff**

Run:

```bash
git diff -- README.md docs/DEVELOPMENT.md
git status --short
```

Expected: the focused diff contains only the README rewrite and new developer guide; pre-existing unrelated deletions remain untouched.

- [ ] **Step 4: Commit the documentation refactor**

```bash
git add README.md docs/DEVELOPMENT.md
git commit -m "docs: simplify README for users"
```
