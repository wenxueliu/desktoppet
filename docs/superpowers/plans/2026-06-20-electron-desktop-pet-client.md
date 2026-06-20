# Electron Desktop Pet Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the macOS/Windows Electron desktop pet client defined in `docs/requirements/desktop-client-prd.md`, including transparent pet window, control panel, local config, trigger/action rules, asset import, `.petpack` import/export, tray/context menu, and packaging checks.

**Architecture:** Use Electron with one main process, isolated preload APIs, and two renderer entries: `pet` for the transparent desktop pet window and `panel` for the control panel. Keep business logic in shared pure JavaScript modules so rule matching, manifest validation, config migration, and package import/export can be tested without launching Electron.

**Tech Stack:** Electron, Vite, vanilla HTML/CSS/JavaScript, Vitest, Playwright for Electron smoke tests, jszip for `.petpack`, electron-builder for macOS/Windows packaging.

---

## Scope

This plan covers the client MVP only. It does not implement website, payment, backend order management, login, cloud sync, online marketplace, or AI generation.

## Proposed File Structure

```text
desktop-pet/
├── package.json
├── vite.config.js
├── vitest.config.js
├── playwright.config.js
├── electron-builder.yml
├── src/
│   ├── main/
│   │   ├── main.js
│   │   ├── windows.js
│   │   ├── ipc.js
│   │   ├── tray.js
│   │   ├── menu.js
│   │   ├── startup.js
│   │   └── services/
│   │       ├── config-store.js
│   │       ├── asset-store.js
│   │       ├── petpack.js
│   │       └── logger.js
│   ├── preload/
│   │   ├── pet-preload.js
│   │   └── panel-preload.js
│   ├── shared/
│   │   ├── schema.js
│   │   ├── defaults.js
│   │   ├── manifest-validator.js
│   │   ├── rule-engine.js
│   │   ├── event-context.js
│   │   ├── action-runner.js
│   │   └── path-safety.js
│   ├── renderer/
│   │   ├── pet/
│   │   │   ├── pet.html
│   │   │   ├── pet.js
│   │   │   └── pet.css
│   │   └── panel/
│   │       ├── panel.html
│   │       ├── panel.js
│   │       └── panel.css
│   └── assets/
│       └── default-pet/
│           ├── manifest.json
│           └── assets/
│               ├── idle.svg
│               ├── click.svg
│               └── drag.svg
├── tests/
│   ├── shared/
│   │   ├── manifest-validator.test.js
│   │   ├── rule-engine.test.js
│   │   ├── event-context.test.js
│   │   └── path-safety.test.js
│   ├── main/
│   │   ├── config-store.test.js
│   │   └── petpack.test.js
│   └── e2e/
│       └── electron-smoke.spec.js
└── docs/
    ├── requirements/
    │   └── desktop-client-prd.md
    └── superpowers/
        └── plans/
            └── 2026-06-20-electron-desktop-pet-client.md
```

## Milestones

1. App shell: Electron app starts, pet window and panel window open.
2. Config: local JSON config loads, saves, migrates, and survives restart.
3. Default pet: transparent desktop pet renders with default idle/click/drag behavior.
4. Rule engine: trigger conditions, filters, OR/AND, cooldown, priority, and interruption work in tests.
5. Control panel: user can manage display, actions, rules, and assets.
6. Petpack: `.petpack` import/export validates manifest, copies assets, blocks unsafe paths.
7. System UX: tray, right-click menu, topmost, mouse passthrough, lock drag, reset position.
8. Packaging: macOS and Windows package configs exist and smoke tests pass.

---

### Task 1: Scaffold Electron Project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `playwright.config.js`
- Create: `electron-builder.yml`
- Create: `src/main/main.js`
- Create: `src/main/windows.js`
- Create: `src/preload/pet-preload.js`
- Create: `src/preload/panel-preload.js`
- Create: `src/renderer/pet/pet.html`
- Create: `src/renderer/pet/pet.js`
- Create: `src/renderer/pet/pet.css`
- Create: `src/renderer/panel/panel.html`
- Create: `src/renderer/panel/panel.js`
- Create: `src/renderer/panel/panel.css`

- [ ] **Step 1: Initialize package metadata and scripts**

Create `package.json` with:

```json
{
  "name": "desktop-pet",
  "version": "0.1.0",
  "private": true,
  "description": "Cross-platform Electron desktop pet client",
  "main": "src/main/main.js",
  "type": "commonjs",
  "scripts": {
    "dev": "electron .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "build": "vite build",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "dependencies": {
    "electron-store": "^10.0.0",
    "jszip": "^3.10.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules/` and `package-lock.json` are created, with no install errors.

- [ ] **Step 3: Add Vite and test config**

Create `vite.config.js`:

```js
const { defineConfig } = require("vite");

module.exports = defineConfig({
  root: "src/renderer",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        pet: "src/renderer/pet/pet.html",
        panel: "src/renderer/panel/panel.html"
      }
    }
  }
});
```

Create `vitest.config.js`:

```js
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"]
  }
});
```

Create `playwright.config.js`:

```js
module.exports = {
  testDir: "tests/e2e",
  timeout: 30000,
  use: {
    trace: "retain-on-failure"
  }
};
```

- [ ] **Step 4: Add Electron builder config**

Create `electron-builder.yml`:

```yaml
appId: win.aisuper.desktop-pet
productName: Desktop Pet
directories:
  output: release
files:
  - src/**
  - dist/**
  - package.json
mac:
  target:
    - dmg
win:
  target:
    - nsis
```

- [ ] **Step 5: Create main process and windows**

Create `src/main/main.js`:

```js
const { app } = require("electron");
const { createPetWindow, createPanelWindow } = require("./windows");

let windows;

async function boot() {
  windows = await createPetWindow();
  await createPanelWindow({ show: false });
}

app.whenReady().then(boot);

app.on("activate", async () => {
  if (!windows || windows.pet.isDestroyed()) {
    windows = await createPetWindow();
  }
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
```

Create `src/main/windows.js`:

```js
const path = require("path");
const { BrowserWindow } = require("electron");

let petWindow;
let panelWindow;

function rendererPath(name) {
  return path.join(__dirname, "..", "renderer", name, `${name}.html`);
}

async function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 320,
    height: 320,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "pet-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await petWindow.loadFile(rendererPath("pet"));
  return { pet: petWindow, panel: panelWindow };
}

async function createPanelWindow({ show = true } = {}) {
  panelWindow = new BrowserWindow({
    width: 960,
    height: 680,
    show,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "panel-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await panelWindow.loadFile(rendererPath("panel"));
  return panelWindow;
}

function getWindows() {
  return { pet: petWindow, panel: panelWindow };
}

module.exports = { createPetWindow, createPanelWindow, getWindows };
```

- [ ] **Step 6: Create preload placeholders**

Create `src/preload/pet-preload.js`:

```js
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  version: "0.1.0"
});
```

Create `src/preload/panel-preload.js`:

```js
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopPetPanel", {
  version: "0.1.0"
});
```

- [ ] **Step 7: Create pet and panel renderer placeholders**

Create `src/renderer/pet/pet.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Desktop Pet</title>
    <link rel="stylesheet" href="./pet.css">
  </head>
  <body>
    <main id="pet-root">
      <div id="pet-sprite" aria-label="desktop pet"></div>
      <div id="message-bubble" hidden></div>
    </main>
    <script src="./pet.js"></script>
  </body>
</html>
```

Create `src/renderer/pet/pet.css`:

```css
html,
body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  user-select: none;
}

#pet-root {
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
}

#pet-sprite {
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #fff 0 20%, #9ad7ff 21% 55%, transparent 56%);
}
```

Create `src/renderer/pet/pet.js`:

```js
console.log("pet renderer ready", window.desktopPet.version);
```

Create `src/renderer/panel/panel.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Desktop Pet Control Panel</title>
    <link rel="stylesheet" href="./panel.css">
  </head>
  <body>
    <main>
      <h1>Desktop Pet</h1>
      <nav id="tabs"></nav>
      <section id="panel-root"></section>
    </main>
    <script src="./panel.js"></script>
  </body>
</html>
```

Create `src/renderer/panel/panel.css`:

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1f2937;
  background: #f8fafc;
}

main {
  padding: 24px;
}
```

Create `src/renderer/panel/panel.js`:

```js
document.querySelector("#panel-root").textContent = `Panel ready ${window.desktopPetPanel.version}`;
```

- [ ] **Step 8: Run the shell**

Run:

```bash
npm run dev
```

Expected: a transparent pet window appears and the app stays open after panel windows are closed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.js vitest.config.js playwright.config.js electron-builder.yml src
git commit -m "chore: scaffold electron desktop pet client"
```

---

### Task 2: Define Shared Schemas, Defaults, and Manifest Validation

**Files:**
- Create: `src/shared/schema.js`
- Create: `src/shared/defaults.js`
- Create: `src/shared/manifest-validator.js`
- Create: `tests/shared/manifest-validator.test.js`

- [ ] **Step 1: Write failing manifest validation tests**

Create `tests/shared/manifest-validator.test.js`:

```js
const { describe, expect, it } = require("vitest");
const { validateManifest } = require("../../src/shared/manifest-validator");

describe("validateManifest", () => {
  it("accepts a valid manifest with actions and trigger filters", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "cute-dog-001",
      name: "Cute Dog",
      version: "1.0.0",
      states: {
        idle: [{ id: "idle", asset: "assets/idle.webm", loop: true }]
      },
      actions: [
        { id: "wave", name: "Wave", type: "playAnimation", asset: "assets/wave.webm" }
      ],
      triggers: [
        {
          id: "approach",
          name: "Approach",
          enabled: true,
          relation: "single",
          conditions: [
            {
              type: "mouseMove",
              filters: [
                { field: "distanceToPetBounds", operator: "<=", value: 80, unit: "px" }
              ]
            }
          ],
          actions: ["wave"]
        }
      ]
    }, new Set(["assets/idle.webm", "assets/wave.webm"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects missing idle state", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "bad",
      name: "Bad",
      version: "1.0.0",
      states: {}
    }, new Set());

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("states.idle is required");
  });

  it("rejects unsupported trigger filter fields", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "bad-filter",
      name: "Bad Filter",
      version: "1.0.0",
      states: {
        idle: [{ id: "idle", asset: "assets/idle.webm", loop: true }]
      },
      actions: [{ id: "wave", name: "Wave", type: "playAnimation", asset: "assets/wave.webm" }],
      triggers: [
        {
          id: "bad-rule",
          name: "Bad Rule",
          relation: "single",
          conditions: [{ type: "mouseMove", filters: [{ field: "unknown", operator: "=", value: true }] }],
          actions: ["wave"]
        }
      ]
    }, new Set(["assets/idle.webm", "assets/wave.webm"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("triggers[0].conditions[0].filters[0].field is not supported for mouseMove");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/shared/manifest-validator.test.js
```

Expected: FAIL because `src/shared/manifest-validator.js` does not exist.

- [ ] **Step 3: Implement schema constants and default pet config**

Create `src/shared/schema.js`:

```js
const SUPPORTED_ASSET_EXTENSIONS = [".gif", ".webp", ".webm", ".mp4", ".mov", ".png", ".svg"];
const SUPPORTED_RELATIONS = ["single", "or", "and"];
const SUPPORTED_OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "between", "in", "notIn"];
const SUPPORTED_ACTION_TYPES = [
  "playAnimation",
  "switchState",
  "showMessage",
  "randomMessage",
  "changeScale",
  "changeOpacity",
  "hidePet",
  "showPet",
  "resetPosition",
  "openPanel"
];

const TRIGGER_PARAMETER_FIELDS = {
  click: ["timestamp", "eventSource", "petPosition", "mousePosition", "mouseLocalPosition", "isInsidePet"],
  doubleClick: ["timestamp", "eventSource", "petPosition", "mousePosition", "mouseLocalPosition", "isInsidePet"],
  rightClick: ["timestamp", "eventSource", "petPosition", "mousePosition", "mouseLocalPosition", "isInsidePet"],
  dragStart: ["timestamp", "petPosition", "mousePosition", "dragStartPosition"],
  dragging: ["timestamp", "petPosition", "mousePosition", "currentPosition", "dragDeltaX", "dragDeltaY", "dragDistance", "dragDurationMs"],
  dragEnd: ["timestamp", "petPosition", "mousePosition", "currentPosition", "dragDeltaX", "dragDeltaY", "dragDistance", "dragDurationMs"],
  mouseEnter: ["timestamp", "eventSource", "petPosition", "mousePosition", "mouseLocalPosition", "isInsidePet", "distanceToPetCenter", "distanceToPetBounds"],
  mouseLeave: ["timestamp", "eventSource", "petPosition", "mousePosition", "mouseLocalPosition", "isInsidePet", "distanceToPetCenter", "distanceToPetBounds"],
  mouseMove: ["timestamp", "eventSource", "petPosition", "mousePosition", "mouseLocalPosition", "isInsidePet", "distanceToPetCenter", "distanceToPetBounds", "deltaX", "deltaY", "speed", "direction", "isMovingTowardPet", "isMovingAwayFromPet"],
  hoverDuration: ["timestamp", "elapsedMs", "isInsidePet"],
  idleDuration: ["timestamp", "elapsedMs"],
  timer: ["timestamp", "currentTime", "currentHour", "dayOfWeek"],
  randomTimer: ["timestamp", "currentTime", "currentHour", "dayOfWeek"],
  appLaunch: ["timestamp"],
  packageLoaded: ["timestamp"]
};

module.exports = {
  SUPPORTED_ASSET_EXTENSIONS,
  SUPPORTED_RELATIONS,
  SUPPORTED_OPERATORS,
  SUPPORTED_ACTION_TYPES,
  TRIGGER_PARAMETER_FIELDS
};
```

Create `src/shared/defaults.js`:

```js
const DEFAULT_CONFIG = {
  currentPackageId: "default-pet",
  display: {
    x: 80,
    y: 160,
    scale: 1,
    opacity: 1,
    alwaysOnTop: true,
    mousePassthrough: false,
    locked: false,
    showHoverButtons: true
  },
  system: {
    launchAtLogin: false,
    language: "zh-CN"
  }
};

const DEFAULT_RULE_TEMPLATES = [
  {
    id: "default-click-greeting",
    name: "点击打招呼",
    enabled: true,
    relation: "single",
    conditions: [{ type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }],
    cooldownMs: 1000,
    priority: 50,
    actionStrategy: "sequence",
    actions: ["default-click", "default-random-click-message"]
  },
  {
    id: "default-dragging",
    name: "拖动中",
    enabled: true,
    relation: "or",
    conditions: [{ type: "dragStart" }, { type: "dragging" }],
    cooldownMs: 0,
    priority: 90,
    actionStrategy: "sequence",
    interruptCurrent: true,
    actions: ["default-drag"]
  }
];

module.exports = { DEFAULT_CONFIG, DEFAULT_RULE_TEMPLATES };
```

- [ ] **Step 4: Implement manifest validation**

Create `src/shared/manifest-validator.js`:

```js
const {
  SUPPORTED_ACTION_TYPES,
  SUPPORTED_OPERATORS,
  SUPPORTED_RELATIONS,
  TRIGGER_PARAMETER_FIELDS
} = require("./schema");

function validateManifest(manifest, availableFiles = new Set()) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") errors.push("manifest must be an object");
  if (!manifest.schemaVersion) errors.push("schemaVersion is required");
  if (!manifest.packageId) errors.push("packageId is required");
  if (!manifest.name) errors.push("name is required");
  if (!manifest.version) errors.push("version is required");
  if (!manifest.states || !Array.isArray(manifest.states.idle) || manifest.states.idle.length === 0) {
    errors.push("states.idle is required");
  }

  const stateEntries = manifest.states ? Object.values(manifest.states).flat() : [];
  for (const state of stateEntries) {
    if (state.asset && availableFiles.size > 0 && !availableFiles.has(state.asset)) {
      errors.push(`asset not found: ${state.asset}`);
    }
  }

  const actionIds = new Set();
  for (const [index, action] of (manifest.actions || []).entries()) {
    if (!action.id) errors.push(`actions[${index}].id is required`);
    if (action.id) actionIds.add(action.id);
    if (action.type && !SUPPORTED_ACTION_TYPES.includes(action.type)) {
      errors.push(`actions[${index}].type is not supported`);
    }
    if (action.asset && availableFiles.size > 0 && !availableFiles.has(action.asset)) {
      errors.push(`asset not found: ${action.asset}`);
    }
  }

  for (const [ruleIndex, rule] of (manifest.triggers || []).entries()) {
    if (!SUPPORTED_RELATIONS.includes(rule.relation)) {
      errors.push(`triggers[${ruleIndex}].relation is not supported`);
    }
    for (const actionId of rule.actions || []) {
      if (!actionIds.has(actionId)) errors.push(`triggers[${ruleIndex}].actions references missing action: ${actionId}`);
    }
    for (const [conditionIndex, rawCondition] of (rule.conditions || []).entries()) {
      const condition = typeof rawCondition === "string" ? { type: rawCondition } : rawCondition;
      const fields = TRIGGER_PARAMETER_FIELDS[condition.type];
      if (!fields) {
        errors.push(`triggers[${ruleIndex}].conditions[${conditionIndex}].type is not supported`);
        continue;
      }
      for (const [filterIndex, filter] of (condition.filters || []).entries()) {
        if (!fields.includes(filter.field)) {
          errors.push(`triggers[${ruleIndex}].conditions[${conditionIndex}].filters[${filterIndex}].field is not supported for ${condition.type}`);
        }
        if (!SUPPORTED_OPERATORS.includes(filter.operator)) {
          errors.push(`triggers[${ruleIndex}].conditions[${conditionIndex}].filters[${filterIndex}].operator is not supported`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateManifest };
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/shared/manifest-validator.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared tests/shared
git commit -m "feat: add manifest schema validation"
```

---

### Task 3: Implement Local Config Store

**Files:**
- Create: `src/main/services/config-store.js`
- Create: `tests/main/config-store.test.js`

- [ ] **Step 1: Write failing config-store tests**

Create `tests/main/config-store.test.js`:

```js
const { describe, expect, it } = require("vitest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createConfigStore } = require("../../src/main/services/config-store");

describe("createConfigStore", () => {
  it("loads defaults when config file does not exist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-config-"));
    const store = createConfigStore(dir);
    expect(store.load().currentPackageId).toBe("default-pet");
  });

  it("persists updates", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-config-"));
    const store = createConfigStore(dir);
    store.save({ ...store.load(), display: { ...store.load().display, scale: 1.5 } });
    expect(createConfigStore(dir).load().display.scale).toBe(1.5);
  });

  it("recovers from invalid json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-config-"));
    fs.writeFileSync(path.join(dir, "config.json"), "{bad json");
    const store = createConfigStore(dir);
    expect(store.load().currentPackageId).toBe("default-pet");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/main/config-store.test.js
```

Expected: FAIL because `config-store.js` does not exist.

- [ ] **Step 3: Implement config store**

Create `src/main/services/config-store.js`:

```js
const fs = require("fs");
const path = require("path");
const { DEFAULT_CONFIG } = require("../../shared/defaults");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function mergeConfig(config) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    display: { ...DEFAULT_CONFIG.display, ...(config.display || {}) },
    system: { ...DEFAULT_CONFIG.system, ...(config.system || {}) }
  };
}

function createConfigStore(userDataDir) {
  const filePath = path.join(userDataDir, "config.json");

  function load() {
    ensureDir(userDataDir);
    if (!fs.existsSync(filePath)) return mergeConfig({});
    try {
      return mergeConfig(JSON.parse(fs.readFileSync(filePath, "utf8")));
    } catch {
      return mergeConfig({});
    }
  }

  function save(nextConfig) {
    ensureDir(userDataDir);
    fs.writeFileSync(filePath, JSON.stringify(mergeConfig(nextConfig), null, 2));
    return load();
  }

  return { load, save, filePath };
}

module.exports = { createConfigStore };
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/main/config-store.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/config-store.js tests/main/config-store.test.js
git commit -m "feat: add local config store"
```

---

### Task 4: Add IPC Contracts and Window Controls

**Files:**
- Create: `src/main/ipc.js`
- Modify: `src/main/main.js`
- Modify: `src/main/windows.js`
- Modify: `src/preload/pet-preload.js`
- Modify: `src/preload/panel-preload.js`

- [ ] **Step 1: Add IPC handlers**

Create `src/main/ipc.js`:

```js
const { app, ipcMain } = require("electron");
const { createConfigStore } = require("./services/config-store");

function registerIpc({ getWindows }) {
  const configStore = createConfigStore(app.getPath("userData"));

  ipcMain.handle("config:load", () => configStore.load());
  ipcMain.handle("config:save", (_event, config) => configStore.save(config));
  ipcMain.handle("panel:show", () => {
    const { panel } = getWindows();
    panel?.show();
    panel?.focus();
  });
  ipcMain.handle("pet:set-always-on-top", (_event, enabled) => {
    getWindows().pet?.setAlwaysOnTop(Boolean(enabled));
  });
  ipcMain.handle("pet:set-mouse-passthrough", (_event, enabled) => {
    getWindows().pet?.setIgnoreMouseEvents(Boolean(enabled), { forward: true });
  });
  ipcMain.handle("pet:set-bounds", (_event, bounds) => {
    getWindows().pet?.setBounds(bounds);
  });
  ipcMain.handle("app:quit", () => app.quit());
}

module.exports = { registerIpc };
```

- [ ] **Step 2: Register IPC in main process**

Modify `src/main/main.js`:

```js
const { app } = require("electron");
const { createPetWindow, createPanelWindow, getWindows } = require("./windows");
const { registerIpc } = require("./ipc");

let booted = false;

async function boot() {
  await createPetWindow();
  await createPanelWindow({ show: false });
  if (!booted) {
    registerIpc({ getWindows });
    booted = true;
  }
}

app.whenReady().then(boot);

app.on("activate", async () => {
  const { pet } = getWindows();
  if (!pet || pet.isDestroyed()) await boot();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
```

- [ ] **Step 3: Expose safe preload APIs**

Modify `src/preload/pet-preload.js`:

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  config: {
    load: () => ipcRenderer.invoke("config:load"),
    save: (config) => ipcRenderer.invoke("config:save", config)
  },
  panel: {
    show: () => ipcRenderer.invoke("panel:show")
  },
  pet: {
    setBounds: (bounds) => ipcRenderer.invoke("pet:set-bounds", bounds),
    setMousePassthrough: (enabled) => ipcRenderer.invoke("pet:set-mouse-passthrough", enabled),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke("pet:set-always-on-top", enabled)
  }
});
```

Modify `src/preload/panel-preload.js`:

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPetPanel", {
  config: {
    load: () => ipcRenderer.invoke("config:load"),
    save: (config) => ipcRenderer.invoke("config:save", config)
  },
  pet: {
    setMousePassthrough: (enabled) => ipcRenderer.invoke("pet:set-mouse-passthrough", enabled),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke("pet:set-always-on-top", enabled)
  },
  app: {
    quit: () => ipcRenderer.invoke("app:quit")
  }
});
```

- [ ] **Step 4: Run app manually**

Run:

```bash
npm run dev
```

Expected: no preload or IPC errors in devtools console.

- [ ] **Step 5: Commit**

```bash
git add src/main src/preload
git commit -m "feat: add ipc window controls"
```

---

### Task 5: Implement Rule Engine and Event Context

**Files:**
- Create: `src/shared/rule-engine.js`
- Create: `src/shared/event-context.js`
- Create: `tests/shared/rule-engine.test.js`
- Create: `tests/shared/event-context.test.js`

- [ ] **Step 1: Write failing rule-engine tests**

Create `tests/shared/rule-engine.test.js`:

```js
const { describe, expect, it } = require("vitest");
const { evaluateRules } = require("../../src/shared/rule-engine");

describe("evaluateRules", () => {
  it("matches single condition with filters", () => {
    const matches = evaluateRules({
      rules: [{
        id: "approach",
        enabled: true,
        relation: "single",
        priority: 70,
        cooldownMs: 0,
        conditions: [{
          type: "mouseMove",
          filters: [
            { field: "distanceToPetBounds", operator: "<=", value: 80 },
            { field: "isMovingTowardPet", operator: "=", value: true }
          ]
        }],
        actions: ["wave"]
      }],
      eventHistory: [{ type: "mouseMove", timestamp: 1000, distanceToPetBounds: 60, isMovingTowardPet: true }],
      now: 1000,
      lastTriggeredAtByRuleId: {}
    });
    expect(matches[0].id).toBe("approach");
  });

  it("respects AND window", () => {
    const matches = evaluateRules({
      rules: [{
        id: "enter-click",
        enabled: true,
        relation: "and",
        windowMs: 3000,
        cooldownMs: 0,
        conditions: [{ type: "mouseEnter" }, { type: "click" }],
        actions: ["hello"]
      }],
      eventHistory: [{ type: "mouseEnter", timestamp: 1000 }, { type: "click", timestamp: 3500 }],
      now: 3500,
      lastTriggeredAtByRuleId: {}
    });
    expect(matches).toHaveLength(1);
  });

  it("filters by cooldown and sorts by priority", () => {
    const matches = evaluateRules({
      rules: [
        { id: "low", enabled: true, relation: "single", priority: 10, cooldownMs: 0, conditions: [{ type: "click" }], actions: ["a"] },
        { id: "high", enabled: true, relation: "single", priority: 90, cooldownMs: 1000, conditions: [{ type: "click" }], actions: ["b"] }
      ],
      eventHistory: [{ type: "click", timestamp: 2000 }],
      now: 2000,
      lastTriggeredAtByRuleId: { high: 1500 }
    });
    expect(matches.map((rule) => rule.id)).toEqual(["low"]);
  });
});
```

- [ ] **Step 2: Write failing event-context tests**

Create `tests/shared/event-context.test.js`:

```js
const { describe, expect, it } = require("vitest");
const { createMouseMoveContext } = require("../../src/shared/event-context");

describe("createMouseMoveContext", () => {
  it("computes inside, distance, speed, and direction", () => {
    const context = createMouseMoveContext({
      timestamp: 1000,
      previous: { timestamp: 900, x: 100, y: 100, distanceToPetCenter: 100 },
      mousePosition: { x: 130, y: 100 },
      petPosition: { x: 100, y: 80, width: 100, height: 100 }
    });

    expect(context.isInsidePet).toBe(true);
    expect(context.distanceToPetCenter).toBe(20);
    expect(context.speed).toBe(300);
    expect(context.direction).toBe("right");
    expect(context.isMovingTowardPet).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- tests/shared/rule-engine.test.js tests/shared/event-context.test.js
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement rule engine**

Create `src/shared/rule-engine.js`:

```js
function compare(actual, operator, expected) {
  if (operator === "=") return actual === expected;
  if (operator === "!=") return actual !== expected;
  if (operator === ">") return actual > expected;
  if (operator === ">=") return actual >= expected;
  if (operator === "<") return actual < expected;
  if (operator === "<=") return actual <= expected;
  if (operator === "between") return actual >= expected[0] && actual <= expected[1];
  if (operator === "in") return expected.includes(actual);
  if (operator === "notIn") return !expected.includes(actual);
  return false;
}

function conditionMatches(condition, event) {
  if (!event || condition.type !== event.type) return false;
  return (condition.filters || []).every((filter) => compare(event[filter.field], filter.operator, filter.value));
}

function findMatchingEvent(condition, eventHistory, since) {
  return eventHistory.find((event) => event.timestamp >= since && conditionMatches(condition, event));
}

function isCoolingDown(rule, now, lastTriggeredAtByRuleId) {
  const last = lastTriggeredAtByRuleId[rule.id];
  return typeof last === "number" && now - last < (rule.cooldownMs || 0);
}

function ruleMatches(rule, eventHistory, now) {
  const conditions = (rule.conditions || []).map((condition) => typeof condition === "string" ? { type: condition } : condition);
  if (conditions.length === 0) return false;
  if (rule.relation === "single") return Boolean(findMatchingEvent(conditions[0], eventHistory, 0));
  if (rule.relation === "or") return conditions.some((condition) => findMatchingEvent(condition, eventHistory, 0));
  if (rule.relation === "and") {
    const since = now - (rule.windowMs || 0);
    return conditions.every((condition) => findMatchingEvent(condition, eventHistory, since));
  }
  return false;
}

function evaluateRules({ rules, eventHistory, now, lastTriggeredAtByRuleId }) {
  return rules
    .filter((rule) => rule.enabled !== false)
    .filter((rule) => !isCoolingDown(rule, now, lastTriggeredAtByRuleId))
    .filter((rule) => ruleMatches(rule, eventHistory, now))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

module.exports = { evaluateRules };
```

- [ ] **Step 5: Implement event context**

Create `src/shared/event-context.js`:

```js
function distance(a, b) {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y));
}

function directionFromDelta(deltaX, deltaY) {
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    if (deltaX > 0) return "right";
    if (deltaX < 0) return "left";
  }
  if (deltaY > 0) return "down";
  if (deltaY < 0) return "up";
  return "none";
}

function createMouseMoveContext({ timestamp, previous, mousePosition, petPosition }) {
  const center = { x: petPosition.x + petPosition.width / 2, y: petPosition.y + petPosition.height / 2 };
  const isInsidePet = mousePosition.x >= petPosition.x &&
    mousePosition.x <= petPosition.x + petPosition.width &&
    mousePosition.y >= petPosition.y &&
    mousePosition.y <= petPosition.y + petPosition.height;
  const deltaX = previous ? mousePosition.x - previous.x : 0;
  const deltaY = previous ? mousePosition.y - previous.y : 0;
  const elapsedSeconds = previous ? Math.max((timestamp - previous.timestamp) / 1000, 0.001) : 1;
  const distanceToPetCenter = distance(mousePosition, center);
  const distanceToPetBounds = isInsidePet ? 0 : Math.min(
    Math.abs(mousePosition.x - petPosition.x),
    Math.abs(mousePosition.x - (petPosition.x + petPosition.width)),
    Math.abs(mousePosition.y - petPosition.y),
    Math.abs(mousePosition.y - (petPosition.y + petPosition.height))
  );
  return {
    type: "mouseMove",
    timestamp,
    eventSource: "globalMouse",
    petPosition,
    mousePosition,
    mouseLocalPosition: { x: mousePosition.x - petPosition.x, y: mousePosition.y - petPosition.y },
    isInsidePet,
    distanceToPetCenter,
    distanceToPetBounds,
    deltaX,
    deltaY,
    speed: Math.round(Math.hypot(deltaX, deltaY) / elapsedSeconds),
    direction: directionFromDelta(deltaX, deltaY),
    isMovingTowardPet: previous ? distanceToPetCenter < previous.distanceToPetCenter : false,
    isMovingAwayFromPet: previous ? distanceToPetCenter > previous.distanceToPetCenter : false
  };
}

module.exports = { createMouseMoveContext };
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/shared/rule-engine.test.js tests/shared/event-context.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/rule-engine.js src/shared/event-context.js tests/shared
git commit -m "feat: add trigger rule engine"
```

---

### Task 6: Build Pet Renderer, Default Actions, and Drag Handling

**Files:**
- Create: `src/shared/action-runner.js`
- Modify: `src/renderer/pet/pet.html`
- Modify: `src/renderer/pet/pet.css`
- Modify: `src/renderer/pet/pet.js`

- [ ] **Step 1: Add action runner**

Create `src/shared/action-runner.js`:

```js
function selectActions(rule, actionsById) {
  const ids = rule.actions || [];
  if (rule.actionStrategy === "random") {
    const selected = ids[Math.floor(Math.random() * ids.length)];
    return selected ? [actionsById[selected]].filter(Boolean) : [];
  }
  return ids.map((id) => actionsById[id]).filter(Boolean);
}

module.exports = { selectActions };
```

- [ ] **Step 2: Update pet markup**

Modify `src/renderer/pet/pet.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Desktop Pet</title>
    <link rel="stylesheet" href="./pet.css">
  </head>
  <body>
    <main id="pet-root">
      <button id="settings-button" title="设置" aria-label="设置">⚙</button>
      <img id="pet-sprite" alt="desktop pet">
      <div id="message-bubble" hidden></div>
    </main>
    <script src="./pet.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Update pet CSS**

Modify `src/renderer/pet/pet.css`:

```css
html,
body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  user-select: none;
}

#pet-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
}

#pet-sprite {
  max-width: 90%;
  max-height: 90%;
  -webkit-user-drag: none;
  pointer-events: auto;
}

#settings-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.86);
  opacity: 0;
}

#pet-root:hover #settings-button {
  opacity: 1;
}

#message-bubble {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 220px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  color: #1f2937;
  font-size: 13px;
  line-height: 1.4;
}
```

- [ ] **Step 4: Implement basic pet interaction**

Modify `src/renderer/pet/pet.js`:

```js
const sprite = document.querySelector("#pet-sprite");
const bubble = document.querySelector("#message-bubble");
const settingsButton = document.querySelector("#settings-button");

const defaultAssets = {
  idle: "../../assets/default-pet/assets/idle.svg",
  click: "../../assets/default-pet/assets/click.svg",
  drag: "../../assets/default-pet/assets/drag.svg"
};

let currentState = "idle";
let dragging = false;
let dragStart = null;

function playState(state) {
  currentState = state;
  sprite.src = defaultAssets[state] || defaultAssets.idle;
}

function showMessage(text, durationMs = 2200) {
  bubble.textContent = text;
  bubble.hidden = false;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => {
    bubble.hidden = true;
  }, durationMs);
}

sprite.addEventListener("click", () => {
  if (dragging) return;
  playState("click");
  showMessage("今天也要开心！");
  setTimeout(() => playState("idle"), 1200);
});

sprite.addEventListener("pointerdown", (event) => {
  dragging = true;
  dragStart = { x: event.screenX, y: event.screenY };
  playState("drag");
});

window.addEventListener("pointermove", (event) => {
  if (!dragging || !dragStart) return;
  const deltaX = event.screenX - dragStart.x;
  const deltaY = event.screenY - dragStart.y;
  window.desktopPet.pet.setBounds({ x: event.screenX - 160, y: event.screenY - 160, width: 320, height: 320 });
  if (Math.hypot(deltaX, deltaY) > 80) showMessage("搬家中...");
});

window.addEventListener("pointerup", () => {
  if (!dragging) return;
  dragging = false;
  dragStart = null;
  playState("idle");
});

settingsButton.addEventListener("click", () => {
  window.desktopPet.panel.show();
});

playState(currentState);
```

- [ ] **Step 5: Add default SVG assets**

Create `src/assets/default-pet/assets/idle.svg`, `click.svg`, and `drag.svg` as simple transparent demo sprites. Keep them visually distinct so state switching can be verified.

- [ ] **Step 6: Manual verification**

Run:

```bash
npm run dev
```

Expected: pet displays an image, click changes state and shows text, dragging changes state and moves window, settings button opens panel.

- [ ] **Step 7: Commit**

```bash
git add src/shared/action-runner.js src/renderer/pet src/assets/default-pet
git commit -m "feat: add default pet interactions"
```

---

### Task 7: Build Control Panel UI for Display, Actions, and Rules

**Files:**
- Modify: `src/renderer/panel/panel.html`
- Modify: `src/renderer/panel/panel.css`
- Modify: `src/renderer/panel/panel.js`

- [ ] **Step 1: Build panel layout**

Implement tabs: Overview, Assets, States, Actions, Trigger Rules, Display, System. Use plain buttons and forms.

- [ ] **Step 2: Implement display settings**

Controls:

- Scale slider: 50%-150%.
- Opacity slider: 50%-100%.
- Always on top toggle.
- Mouse passthrough toggle.
- Show hover buttons toggle.
- Reset position button.

Expected behavior: saving settings calls `desktopPetPanel.config.save(nextConfig)` and immediately applies always-on-top and passthrough through preload APIs.

- [ ] **Step 3: Implement built-in trigger condition browser**

Show trigger condition names and supported parameters from `TRIGGER_PARAMETER_FIELDS`. For each parameter, show field name and expected control type:

```js
const FIELD_INPUT_TYPES = {
  isInsidePet: "boolean",
  isMovingTowardPet: "boolean",
  isMovingAwayFromPet: "boolean",
  distanceToPetCenter: "number",
  distanceToPetBounds: "number",
  speed: "number",
  direction: "enum",
  dragDistance: "number",
  dragDurationMs: "number"
};
```

- [ ] **Step 4: Implement trigger rule editor MVP**

The MVP editor must create and edit:

- rule name
- enabled toggle
- relation: single/or/and
- windowMs for AND
- cooldownMs
- priority
- condition type
- filter field/operator/value/unit
- action strategy: sequence/random
- action IDs

- [ ] **Step 5: Implement action editor MVP**

The MVP editor must create and edit:

- action name
- type
- asset path
- loop toggle
- returnToState
- message
- durationMs
- weight

- [ ] **Step 6: Manual verification**

Run:

```bash
npm run dev
```

Expected: panel loads config, edits display settings, shows trigger parameter fields, saves a new action and a new rule.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/panel
git commit -m "feat: add control panel rule editor"
```

---

### Task 8: Implement Asset Import and Preview

**Files:**
- Create: `src/main/services/asset-store.js`
- Modify: `src/main/ipc.js`
- Modify: `src/preload/panel-preload.js`
- Modify: `src/renderer/panel/panel.js`

- [ ] **Step 1: Implement asset validation service**

Create `src/main/services/asset-store.js`:

```js
const fs = require("fs");
const path = require("path");
const { SUPPORTED_ASSET_EXTENSIONS } = require("../../shared/schema");

function validateAsset(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_ASSET_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `不支持的素材格式：${ext}` };
  }
  const stat = fs.statSync(filePath);
  if (stat.size > 50 * 1024 * 1024) {
    return { ok: false, error: "素材超过 50 MB" };
  }
  return { ok: true, ext, size: stat.size };
}

function copyAssetToPackage({ sourcePath, packageDir }) {
  const validation = validateAsset(sourcePath);
  if (!validation.ok) return validation;
  fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
  const target = path.join(packageDir, "assets", path.basename(sourcePath));
  fs.copyFileSync(sourcePath, target);
  return { ok: true, asset: `assets/${path.basename(sourcePath)}` };
}

module.exports = { validateAsset, copyAssetToPackage };
```

- [ ] **Step 2: Add IPC for file picker and asset import**

Add `asset:pick` and `asset:import` handlers in `src/main/ipc.js` using Electron `dialog.showOpenDialog`.

- [ ] **Step 3: Expose asset API to panel**

Modify `src/preload/panel-preload.js` to expose:

```js
assets: {
  pick: () => ipcRenderer.invoke("asset:pick"),
  import: (sourcePath, packageId) => ipcRenderer.invoke("asset:import", { sourcePath, packageId })
}
```

- [ ] **Step 4: Add panel asset page**

Add upload button, preview element, import result message, and state/action binding selector.

- [ ] **Step 5: Manual verification**

Run:

```bash
npm run dev
```

Expected: GIF/WebP/WebM/MP4/MOV/PNG/SVG can be selected, oversized or unsupported files are rejected with clear messages.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/asset-store.js src/main/ipc.js src/preload/panel-preload.js src/renderer/panel
git commit -m "feat: add asset import flow"
```

---

### Task 9: Implement Petpack Import/Export

**Files:**
- Create: `src/shared/path-safety.js`
- Create: `src/main/services/petpack.js`
- Create: `tests/shared/path-safety.test.js`
- Create: `tests/main/petpack.test.js`
- Modify: `src/main/ipc.js`
- Modify: `src/preload/panel-preload.js`
- Modify: `src/renderer/panel/panel.js`

- [ ] **Step 1: Write path safety test**

Create `tests/shared/path-safety.test.js`:

```js
const { describe, expect, it } = require("vitest");
const { isSafeRelativePath } = require("../../src/shared/path-safety");

describe("isSafeRelativePath", () => {
  it("allows safe package paths", () => {
    expect(isSafeRelativePath("assets/idle.webm")).toBe(true);
  });

  it("blocks path traversal", () => {
    expect(isSafeRelativePath("../evil.js")).toBe(false);
    expect(isSafeRelativePath("assets/../../evil.js")).toBe(false);
  });

  it("blocks absolute paths", () => {
    expect(isSafeRelativePath("/tmp/evil.js")).toBe(false);
  });
});
```

- [ ] **Step 2: Implement path safety**

Create `src/shared/path-safety.js`:

```js
const path = require("path");

function isSafeRelativePath(value) {
  if (!value || path.isAbsolute(value)) return false;
  const normalized = path.normalize(value);
  return normalized === value && !normalized.startsWith("..") && !normalized.includes(`..${path.sep}`);
}

module.exports = { isSafeRelativePath };
```

- [ ] **Step 3: Implement petpack service**

Create `src/main/services/petpack.js` with functions:

- `importPetpack(filePath, userDataDir)`
- `exportPetpack(packageId, userDataDir, targetPath)`
- `readManifestFromZip(zip)`
- `validateZipEntries(zip)`

Use `JSZip.loadAsync(buffer)`, validate every entry with `isSafeRelativePath`, parse `manifest.json`, validate with `validateManifest`, and only write after all validation passes.

- [ ] **Step 4: Add IPC and panel buttons**

Expose:

```js
petpack: {
  import: () => ipcRenderer.invoke("petpack:import"),
  export: (packageId) => ipcRenderer.invoke("petpack:export", packageId)
}
```

Add Import `.petpack` and Export Current Package buttons to the System page.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/shared/path-safety.test.js tests/main/petpack.test.js
```

Expected: PASS.

- [ ] **Step 6: Manual verification**

Run:

```bash
npm run dev
```

Expected: valid `.petpack` imports, invalid package shows exact error, exported package can be imported again.

- [ ] **Step 7: Commit**

```bash
git add src/shared/path-safety.js src/main/services/petpack.js tests src/main/ipc.js src/preload/panel-preload.js src/renderer/panel
git commit -m "feat: add petpack import export"
```

---

### Task 10: Add Tray, Right-Click Menu, Startup, and System UX

**Files:**
- Create: `src/main/tray.js`
- Create: `src/main/menu.js`
- Create: `src/main/startup.js`
- Modify: `src/main/main.js`
- Modify: `src/main/ipc.js`
- Modify: `src/renderer/pet/pet.js`
- Modify: `src/renderer/panel/panel.js`

- [ ] **Step 1: Implement context menu items**

Create `src/main/menu.js` with grouped menu items:

```js
function buildPetContextMenu({ app, windows, actions }) {
  const { Menu } = require("electron");
  return Menu.buildFromTemplate([
    { label: "打开控制面板", click: actions.openPanel },
    { label: "导入素材包", click: actions.importPetpack },
    { type: "separator" },
    { label: "显示/隐藏桌宠", click: actions.togglePetVisible },
    { label: "锁定拖动", type: "checkbox", click: actions.toggleDragLocked },
    { label: "鼠标穿透", type: "checkbox", click: actions.toggleMousePassthrough },
    { label: "窗口置顶", type: "checkbox", click: actions.toggleAlwaysOnTop },
    { type: "separator" },
    { label: "切换状态", submenu: actions.stateMenuItems() },
    { label: "切换动作", submenu: actions.actionMenuItems() },
    { label: "暂停互动", type: "checkbox", click: actions.toggleInteractionsPaused },
    { type: "separator" },
    { label: "调整大小", submenu: actions.scaleMenuItems() },
    { label: "透明度", submenu: actions.opacityMenuItems() },
    { label: "重置位置", click: actions.resetPosition },
    { type: "separator" },
    { label: "查看日志", click: actions.openLogs },
    { label: "关于", click: actions.openAbout },
    { label: "退出应用", click: () => app.quit() }
  ]);
}

module.exports = { buildPetContextMenu };
```

- [ ] **Step 2: Implement tray**

Create `src/main/tray.js` with tray icon creation and menu reuse from `buildPetContextMenu`.

- [ ] **Step 3: Implement startup toggle**

Create `src/main/startup.js`:

```js
function setLaunchAtLogin(app, enabled) {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
}

function getLaunchAtLogin(app) {
  return app.getLoginItemSettings().openAtLogin;
}

module.exports = { setLaunchAtLogin, getLaunchAtLogin };
```

- [ ] **Step 4: Wire right-click from pet window**

In `src/renderer/pet/pet.js`, listen for `contextmenu`, prevent default browser menu, and call a preload IPC method `desktopPet.menu.openContextMenu()`.

- [ ] **Step 5: Manual verification**

Run:

```bash
npm run dev
```

Expected: tray menu exists, right-click menu has all PRD items, toggles apply immediately, exit quits app.

- [ ] **Step 6: Commit**

```bash
git add src/main/tray.js src/main/menu.js src/main/startup.js src/main/main.js src/main/ipc.js src/renderer
git commit -m "feat: add tray and context menu"
```

---

### Task 11: Add Smoke Tests, Packaging, and Release Checklist

**Files:**
- Create: `tests/e2e/electron-smoke.spec.js`
- Create: `docs/release/client-release-checklist.md`
- Modify: `package.json`

- [ ] **Step 1: Add Electron smoke test**

Create `tests/e2e/electron-smoke.spec.js`:

```js
const { test, expect } = require("@playwright/test");
const { _electron: electron } = require("playwright");

test("app starts and renders pet window", async () => {
  const app = await electron.launch({ args: ["."] });
  const window = await app.firstWindow();
  await expect(window.locator("#pet-root")).toBeVisible();
  await app.close();
});
```

- [ ] **Step 2: Add release checklist**

Create `docs/release/client-release-checklist.md`:

```markdown
# Client Release Checklist

- [ ] `npm test` passes.
- [ ] `npm run test:e2e` passes.
- [ ] macOS app starts and shows transparent pet window.
- [ ] Windows app starts and shows transparent pet window.
- [ ] Pet can be dragged and position persists after restart.
- [ ] Click action plays and returns to idle.
- [ ] Control panel opens from hover button, tray, and right-click menu.
- [ ] Asset import accepts GIF, WebP, WebM, MP4, MOV, PNG.
- [ ] Invalid asset formats show a clear error.
- [ ] Valid `.petpack` imports.
- [ ] Invalid `.petpack` is rejected without changing current package.
- [ ] Exported `.petpack` can be re-imported.
- [ ] Mouse passthrough toggle works.
- [ ] Always-on-top toggle works.
- [ ] Startup toggle works.
- [ ] App can quit from tray and right-click menu.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run test:e2e
npm run pack
```

Expected: all tests pass and `release/` contains unpacked app output.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e docs/release package.json
git commit -m "test: add client smoke checks"
```

---

## Coverage Review

- Transparent pet window: Tasks 1, 6, 10, 11.
- Control panel: Tasks 1, 7, 8, 9, 10.
- Local config: Tasks 3, 4, 7.
- Built-in trigger conditions and parameters: Tasks 2, 5, 7.
- OR/AND rules, cooldown, priority, interruption: Tasks 5, 7.
- User custom actions: Tasks 2, 7.
- Asset import and preview: Task 8.
- `.petpack` import/export and validation: Task 9.
- Right-click menu and tray: Task 10.
- macOS/Windows packaging checks: Task 11.

## Known MVP Boundaries

- `playSound` is reserved but not required for first implementation.
- Multi-pet simultaneous runtime is not included.
- Login, website, backend, payment, and cloud sync are not included.
- Advanced transparent-channel detection can be added later; MVP only validates file format, size, readability, and playback preview.

