# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev              # Launch Electron app in development mode

# Testing
npm test                 # Run all unit tests (Vitest)
npm run test:watch       # Run tests in watch mode
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:ci      # Run E2E tests without Electron smoke test

# Building
npm run build            # Build renderer processes with Vite
npm run pack             # Package app without creating installer
npm run dist             # Create distributable installer
```

## Architecture Overview

### Electron Process Model

This is a **three-process Electron application** with strict security boundaries:

1. **Main Process** (`src/main/`)
   - Entry point: `main.js` - initializes config, windows, IPC, tray
   - Window management: `windows.js` - pet window (320x320, transparent, frameless, always-on-top) and panel window (960x680, standard frame)
   - IPC hub: `ipc.js` - 31 registered channels handling config, assets, petpack, display, system settings
   - Services: `config-store.js`, `asset-store.js`, `petpack.js`

2. **Preload Scripts** (`src/preload/`)
   - Security bridge using `contextBridge` with context isolation
   - `pet-preload.js` exposes `window.desktopPet` API
   - `panel-preload.js` exposes `window.desktopPetPanel` API
   - No direct Node.js access from renderer processes

3. **Renderer Processes** (`src/renderer/`)
   - Pet renderer: sprite animation, event handling, rule engine integration
   - Panel renderer: modular control panel UI (see Panel Architecture below)
   - Built with Vite for production

### Panel Architecture (Modular)

The control panel (`src/renderer/panel/`) has been refactored from a monolithic 1576-line file into a modular architecture:

**Main Entry** (`panel.js` - 165 lines):
- Orchestrates initialization, config loading, and event routing
- Minimal responsibilities: glue code only

**State Management**:
- `state.js` - Global panel state (35 lines)
- `panel-state.js` - Config operations and form builders (508 lines)

**UI Layer** (`ui/` directory):
- `banner.js` - Banner message management (43 lines)
- `header.js` - Common header component (24 lines)
- `tabs.js` - Tab navigation rendering (30 lines)
- `utils.js` - HTML utilities (escapeHtml, selected, checked, etc.) (115 lines)

**Tab Views** (`tabs/` directory - 8 files, 871 lines total):
- `overview.js` - Overview dashboard (52 lines)
- `assets.js` - Asset management and petpack import/export (208 lines)
- `states.js` - State bindings editor (117 lines)
- `actions.js` - Custom actions editor (117 lines)
- `interaction.js` - Interaction messages and bubble settings (86 lines)
- `rules.js` - Trigger rules editor (173 lines)
- `display.js` - Display settings (68 lines)
- `system.js` - System settings and language (50 lines)

**Reusable Components** (`components/` directory):
- `rule-condition-editor.js` - Rule condition editor component (101 lines)
- `rule-action-selector.js` - Action selector component (34 lines)
- `condition-browser.js` - Condition type browser (45 lines)

**Event Handlers** (`handlers/` directory):
- `form-handlers.js` - Form submission handlers (282 lines)
- `asset-handlers.js` - Asset and petpack operations (252 lines)
- `event-handlers.js` - Click and change event handlers (230 lines)

**Benefits of modular architecture**:
- Each file averages ~130 lines, easy to understand at a glance
- Single responsibility: one file = one concern
- Easy to extend: add new tab by creating one file in `tabs/`
- Parallel development: multiple developers can work without conflicts
- Better IDE performance and code navigation

### Petpack System

**Petpack** is the `.petpack` file format (ZIP) containing:
- `manifest.json` - package metadata, states, actions, rules
- Asset files (GIF, WebP, WebM, MP4, MOV, PNG, SVG)

**Import flow** (`src/main/services/petpack.js`):
1. Validation: check ZIP structure, entry count, file sizes
2. Security: reject symlinks, unsafe paths, oversized files (50MB/file, 200MB/package, 256 entries max)
3. Manifest validation against schema (`src/shared/manifest-validator.js`)
4. Atomic installation: extract to temp → backup existing → atomic rename → rollback on failure

**Export flow**:
1. Collect package files recursively
2. Merge manifest with user config (custom states, actions, rules)
3. Validate merged manifest
4. Create ZIP with merged manifest, atomic write to target

**Storage structure**: `{userDataDir}/packages/{packageId}/manifest.json` and `assets/`

### Rule Engine

**Core file**: `src/shared/rule-engine.js`

**Event evaluation pipeline**:
1. Circular event history buffer (last 40 events with timestamps)
2. Rule matching modes:
   - **Single**: match current event against one condition
   - **OR**: match current event against any condition
   - **AND**: sequential pattern matching within time window (default 3000ms)
3. Per-rule cooldown tracking to prevent spam
4. Priority-sorted action execution

**Condition types**:
- Pointer: click, doubleClick, rightClick, mouseEnter, mouseLeave, mouseMove
- Drag: dragStart, dragging, dragEnd (with position/delta/distance)
- Duration: hoverDuration, idleDuration
- Timer: timer, randomTimer
- Lifecycle: appLaunch, packageLoaded

**Filter operators**: `=`, `!=`, `>`, `>=`, `<`, `<=`, `between`, `in`, `notIn`

**Action execution** (`src/renderer/pet/pet-runtime.js`):
- `playAnimation` - switch sprite, schedule return to idle
- `switchState` - change sprite state permanently
- `showMessage` / `randomMessage` - display message bubble
- `changeScale` / `changeOpacity` - update display properties
- `hidePet` / `showPet` - toggle visibility
- `resetPosition` - move to configured position
- `openPanel` - show control panel

### Configuration and State

**Config store** (`src/main/services/config-store.js`):
- Location: `{userDataDir}/config.json`
- Deep merge with defaults on load
- Sections: `currentPackageId`, `display`, `system`, `interactions`, `states`, `customActions`, `triggerRules`

**State flow**:
1. Panel modifies config → `config:save` IPC
2. Main process persists to disk → broadcasts `pet:runtime-updated`
3. Pet renderer rebuilds runtime model → re-evaluates rules
4. New behavior takes effect immediately (no restart required)

**Defaults** (`src/shared/defaults.js`):
- Pre-configured actions for common interactions (click, drag, hover, random, timed, sleep)
- Default trigger rules and messages
- User config overrides defaults via deep merge

### Security Mechanisms

**Path safety** (`src/shared/path-safety.js`):
- All filesystem paths validated before operations
- Rejects: absolute paths, backslashes, URL schemes, `..` traversal, `.` segments
- Enforces POSIX normalization

**Asset validation** (`src/main/services/asset-store.js`):
- Max 50MB per file, extension whitelist enforced
- Symlink rejection prevents directory traversal
- Assets stored only in package-specific directories
- Import requires prior approval from file picker dialog (sender ID tracking)

**Manifest validation** (`src/shared/manifest-validator.js`):
- Schema version enforcement (currently v1)
- Required fields: `schemaVersion`, `packageId`, `name`, `version`, `states.idle`
- Asset reference checking against available files
- State/action cross-reference validation prevents dangling references

**Context isolation**:
- Preload scripts use `contextBridge.exposeInMainWorld()`
- No `nodeIntegration` in renderer processes
- Controlled API surface via preload bridges
- No direct filesystem or Node.js API access from renderers

### Internationalization (i18n)

**Core file**: `src/shared/i18n.js`

- Dictionary-based translation system
- Supported locales: `en` (English), `zh` (Chinese)
- Fallback chain: requested locale → `en` → key itself
- Simple parameter interpolation: `{paramName}`
- Auto-detection from browser language or localStorage
- Usage: `t("namespace.section.key", {param: value})`

**Translation key organization**:
- `common.*` - shared UI elements (save, delete, cancel, etc.)
- `panel.*` - control panel sections and tabs
- `assets.*` - asset management UI
- `rules.*` - rule editor (condition types, field names, form labels)
- `system.*` - system settings (language, launch at login)

## Key Data Flows

### Package Load
```
User selects .petpack
→ petpack:import IPC
→ Main: Extract, validate, install to packages/{id}/
→ Main: Update config.currentPackageId, emit pet:runtime-updated
→ Pet renderer: Load manifest, merge with config, rebuild runtime
→ Pet renderer: Apply new sprites, rules, schedule timers
```

### Trigger Rule Execution
```
User clicks pet
→ pet.js captures event
→ Build event context (pointer position, timestamp, metadata)
→ Rule engine evaluates against event history
→ Match rules, apply cooldown, return actions (priority-sorted)
→ Execute actions sequentially (with durationMs delays)
→ Update sprite, show message, schedule idle return
```

### Config Update from Panel
```
Panel form submission
→ config:save IPC
→ Main: Merge with defaults, persist to config.json
→ Main: Reload active package, emit pet:runtime-updated
→ Pet renderer: Rebuild runtime model, clear old timers
→ Pet renderer: Schedule new timers based on updated rules
```

## Important Patterns

**IPC Communication**:
- Request-response: `ipcRenderer.invoke(channel, payload)` / `ipcMain.handle(channel, handler)`
- Push updates: `window.webContents.send(channel, data)` / `ipcRenderer.on(channel, callback)`
- All handlers return `{ok: boolean, error?: string}` tuples

**Atomic Operations**:
- Config writes: serialize → write to temp → atomic rename
- Package installs: extract to temp → backup old → rename → delete backup
- Prevents corruption on failure

**Performance Optimizations**:
- Mouse move events throttled to 100ms (prevents excessive rule evaluations)
- Bounds scheduling coalesces rapid window position updates (one IPC per frame)

**ID Generation** (`panel-state.js`):
- Format: `{prefix}-{timestamp36}-{random36}`
- Used for user-created states, actions, rules

## Extension Points

**Adding new action types**:
1. Add type to `SUPPORTED_ACTION_TYPES` in schema
2. Implement handler in `executeRuntimeAction()` (pet-runtime.js)
3. Add form fields to panel action editor (panel-state.js)
4. Add i18n keys for labels

**Adding new condition types**:
1. Add to `TRIGGER_PARAMETER_FIELDS` in schema
2. Define available fields and input types
3. Implement event emission in pet renderer (pet.js)
4. Add filter UI to panel rule editor (panel.js)
5. Add i18n keys for condition type and field names

**Adding new asset types**:
1. Add extension to `SUPPORTED_ASSET_EXTENSIONS` in schema
2. Update MIME type handling if needed
3. Asset validation automatically includes new types

**Adding new display properties**:
1. Add to `DEFAULT_DISPLAY` in defaults.js
2. Handle in `applyDisplay()` in pet renderer
3. Add IPC handlers if native window changes needed (ipc.js)
4. Add panel controls (panel.js)

## Testing Notes

- **138 unit tests** covering main, renderer, and shared modules (Vitest)
- **E2E tests** validate Electron app launch and basic rendering (Playwright)
- Run `npm run test:e2e:ci` in headless environments (skips Electron smoke test)
- Mock electron-store with in-memory implementation for tests
- Use `beforeEach` to reset global state in shared module tests (especially i18n)

## Project Context

- **License**: GPL-3.0
- **Target platforms**: macOS, Windows
- **Tech stack**: Electron 31, Vite 5, Vitest, Playwright
- **Primary language**: JavaScript (CommonJS for main process, ESM for renderer)
- **User base**: Chinese and English speakers (bilingual UI)
