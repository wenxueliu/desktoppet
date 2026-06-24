import { createRequire } from "node:module";
import fs from "node:fs";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const { DEFAULT_CONFIG } = require("../../src/shared/defaults");
const IDLE_ID = "30000000-0000-4000-8000-000000000001";
const WAVE_ID = "30000000-0000-4000-8000-000000000002";

const handlers = new Map();
const mockConfigStore = {
  load: vi.fn(),
  save: vi.fn()
};
const createConfigStore = vi.fn(() => mockConfigStore);
const getPath = vi.fn(() => "/tmp/desktop-pet-user-data");
const quit = vi.fn();
const getLoginItemSettings = vi.fn(() => ({ openAtLogin: false }));
const setLoginItemSettings = vi.fn();
const showOpenDialog = vi.fn();
const showSaveDialog = vi.fn();

const electronMock = {
  app: {
    getPath,
    getLoginItemSettings,
    setLoginItemSettings,
    quit
  },
  dialog: {
    showOpenDialog,
    showSaveDialog
  },
  ipcMain: {
    handle: vi.fn((channel, handler) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel) => {
      handlers.delete(channel);
    }),
    on: vi.fn((channel, handler) => {
      handlers.set(channel, handler);
    })
  }
};

const configStoreMock = {
  createConfigStore
};

function loadIpcModule() {
  const ipcPath = require.resolve("../../src/main/ipc");
  delete require.cache[ipcPath];
  return require("../../src/main/ipc");
}

function createIpcEvent(id = 1) {
  return {
    sender: { id }
  };
}

describe("registerIpc", () => {
  let petWindow;
  let panelWindow;
  let recreatedPanelWindow;
  let getWindows;
  let createPanelWindow;
  let tempDir;
  let userDataDir;

  beforeAll(() => {
    Module._load = (request, parent, isMain) => {
      if (request === "electron") {
        return electronMock;
      }

      if (request === "./services/config-store") {
        return configStoreMock;
      }

      return originalLoad(request, parent, isMain);
    };
  });

  afterAll(() => {
    Module._load = originalLoad;
  });

  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-ipc-"));
    userDataDir = path.join(tempDir, "user-data");
    getPath.mockReturnValue(userDataDir);
    getLoginItemSettings.mockReturnValue({ openAtLogin: false });
    petWindow = {
      isDestroyed: vi.fn(() => false),
      setAlwaysOnTop: vi.fn(),
      setIgnoreMouseEvents: vi.fn(),
      setBounds: vi.fn(),
      getBounds: vi.fn(() => ({ x: 80, y: 160, width: 320, height: 320 })),
      webContents: {
        send: vi.fn()
      }
    };
    panelWindow = {
      isDestroyed: vi.fn(() => false),
      show: vi.fn(),
      focus: vi.fn()
    };
    recreatedPanelWindow = {
      isDestroyed: vi.fn(() => false),
      show: vi.fn(),
      focus: vi.fn()
    };
    getWindows = vi.fn(() => ({ pet: petWindow, panel: panelWindow }));
    createPanelWindow = vi.fn(async () => recreatedPanelWindow);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("registers config load and save handlers with the userData config store", async () => {
    mockConfigStore.load.mockReturnValue({ display: { x: 1 } });
    mockConfigStore.save.mockReturnValue({ display: { x: 2 } });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });

    expect(createConfigStore).toHaveBeenCalledWith(userDataDir);
    expect(handlers.get("config:load")()).toEqual({ display: { x: 1 } });
    expect(handlers.get("config:save")(null, { display: { x: 2 } })).toEqual({ display: { x: 2 } });
    expect(mockConfigStore.save).toHaveBeenCalledWith({ display: { x: 2 } });
  });

  it("broadcasts runtime updates after config saves", async () => {
    mockConfigStore.save.mockReturnValue({ currentPackageId: "missing", triggerRules: [] });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const saved = handlers.get("config:save")(null, { currentPackageId: "missing", triggerRules: [] });

    expect(saved).toEqual({ currentPackageId: "missing", triggerRules: [] });
    expect(petWindow.webContents.send).toHaveBeenCalledWith("pet:runtime-updated", {
      config: { currentPackageId: "missing", triggerRules: [] },
      package: null,
      packageError: "Active package is unavailable"
    });
  });

  it("registers panel and pet window control handlers", async () => {
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    await handlers.get("panel:show")();
    handlers.get("pet:set-always-on-top")(null, 1);
    handlers.get("pet:set-mouse-passthrough")(null, "yes");
    handlers.get("pet:set-bounds")(null, { x: 10, y: 20, width: 320, height: 240 });
    handlers.get("app:quit")();

    expect(panelWindow.show).toHaveBeenCalledOnce();
    expect(panelWindow.focus).toHaveBeenCalledOnce();
    expect(createPanelWindow).not.toHaveBeenCalled();
    expect(petWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(petWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
    expect(petWindow.setBounds).toHaveBeenCalledWith({ x: 10, y: 20, width: 320, height: 240 });
    expect(quit).toHaveBeenCalledOnce();
  });

  it("delegates context menu requests to the registered menu opener", () => {
    const openContextMenu = vi.fn();
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow, openContextMenu });
    handlers.get("menu:open-context-menu")();

    expect(openContextMenu).toHaveBeenCalledOnce();
  });

  it("reads and writes launch-at-login through Electron app settings and config", () => {
    getLoginItemSettings.mockReturnValue({ openAtLogin: true });
    mockConfigStore.load.mockReturnValue({ system: { language: "zh-CN" } });
    mockConfigStore.save.mockImplementation((config) => config);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const current = handlers.get("system:get-launch-at-login")();
    const updated = handlers.get("system:set-launch-at-login")(null, false);

    expect(current).toBe(true);
    expect(updated).toBe(false);
    expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
    expect(mockConfigStore.save).toHaveBeenCalledWith({
      system: {
        language: "zh-CN",
        launchAtLogin: false
      }
    });
  });

  it("creates and focuses the panel window when panel show is invoked without a usable panel", async () => {
    panelWindow.isDestroyed.mockReturnValue(true);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    await handlers.get("panel:show")();

    expect(panelWindow.show).not.toHaveBeenCalled();
    expect(createPanelWindow).toHaveBeenCalledWith({ show: true });
    expect(recreatedPanelWindow.focus).toHaveBeenCalledOnce();
  });

  it("ignores destroyed pet windows and rejects invalid bounds", async () => {
    petWindow.isDestroyed.mockReturnValue(true);
    panelWindow.isDestroyed.mockReturnValue(true);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    handlers.get("pet:set-always-on-top")(null, true);
    handlers.get("pet:set-mouse-passthrough")(null, true);

    expect(petWindow.setAlwaysOnTop).not.toHaveBeenCalled();
    expect(petWindow.setIgnoreMouseEvents).not.toHaveBeenCalled();
    expect(() => handlers.get("pet:set-bounds")(null, { width: 0, height: 10 })).toThrow("Invalid pet bounds");
    expect(petWindow.setBounds).not.toHaveBeenCalled();
  });

  it("picks and imports assets through sanitized package paths", async () => {
    const sourcePath = path.join(tempDir, "idle.svg");
    fs.writeFileSync(sourcePath, "<svg></svg>", "utf8");
    mockConfigStore.load.mockReturnValue({ currentPackageId: "current-pet" });
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [sourcePath] });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const event = createIpcEvent(42);
    const pickedPath = await handlers.get("asset:pick")(event);
    const imported = handlers.get("asset:import")(event, {
      sourcePath,
      packageId: "../bad/pet",
      importName: "friendly idle"
    });

    expect(pickedPath).toBe(sourcePath);
    expect(showOpenDialog).toHaveBeenCalledWith(panelWindow, expect.objectContaining({
      properties: ["openFile"]
    }));
    expect(imported).toEqual({ ok: true, asset: "assets/friendly_idle.svg", displayName: "friendly_idle.svg" });
    expect(fs.existsSync(path.join(userDataDir, "packages", "-bad-pet", "assets", "friendly_idle.svg"))).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, "bad", "pet", "assets", "idle.svg"))).toBe(false);
  });

  it("lists packages with bundled default assets and exports the default package", async () => {
    const targetPath = path.join(tempDir, "default.petpack");
    mockConfigStore.load.mockReturnValue({
      currentPackageId: "default-pet",
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: [{ id: "click", asset: "assets/click.svg", type: "oneshot" }]
      },
      triggerRules: []
    });
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: targetPath });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });

    expect(handlers.get("package:list")()).toEqual({
      ok: true,
      packages: [
        { packageId: "default-pet", isCurrent: true, source: "bundled" }
      ]
    });
    expect(handlers.get("asset:list")(null, "default-pet").assets.map((asset) => asset.asset)).toEqual([
      "assets/click.svg",
      "assets/drag.svg",
      "assets/idle.svg"
    ]);

    const exported = await handlers.get("petpack:export")(null, "default-pet");

    expect(exported.ok).toBe(true);
    expect(exported.packageId).toBe("default-pet");
    expect(fs.existsSync(targetPath)).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, "packages", "default-pet", "assets", "idle.svg"))).toBe(true);
  });

  it("treats an existing default package directory without a manifest like any other broken package", async () => {
    const defaultPackageDir = path.join(userDataDir, "packages", "default-pet");
    const targetPath = path.join(tempDir, "default-repaired.petpack");
    fs.mkdirSync(path.join(defaultPackageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(defaultPackageDir, "assets", "idle.svg"), "<svg></svg>", "utf8");
    mockConfigStore.load.mockReturnValue({
      currentPackageId: "default-pet",
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: []
      },
      triggerRules: []
    });
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: targetPath });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const exported = await handlers.get("petpack:export")(null, "default-pet");

    expect(exported.ok).toBe(false);
    expect(exported.error).toContain("Manifest is invalid");
    expect(JSON.parse(fs.readFileSync(path.join(defaultPackageDir, "manifest.json"), "utf8")).triggerRules).toEqual([]);
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it("persists saved default package animations to the default manifest", () => {
    const animationId = "30000000-0000-4000-8000-000000000005";
    const savedDefaultConfig = {
      currentPackageId: "default-pet",
      animations: {
        default: DEFAULT_CONFIG.animations.default,
        clips: [
          ...DEFAULT_CONFIG.animations.clips,
          { id: animationId, name: "默认跳跃", asset: "assets/idle.svg", type: "oneshot", durationMs: 700 }
        ]
      },
      triggerRules: [
        { id: "jump-rule", name: "Jump Rule", relation: "single", conditions: ["click"], actions: [{ type: "playAnimation", animation: animationId }] }
      ]
    };
    mockConfigStore.save.mockImplementation((config) => config);
    mockConfigStore.load.mockReturnValue(savedDefaultConfig);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    handlers.get("config:save")(null, savedDefaultConfig);
    const manifest = JSON.parse(fs.readFileSync(path.join(userDataDir, "packages", "default-pet", "manifest.json"), "utf8"));

    expect(manifest.animations.clips.some((clip) => clip.id === animationId && clip.name === "默认跳跃")).toBe(true);
    expect(manifest.triggerRules[0]).toMatchObject({ id: "jump-rule", name: "Jump Rule" });
    expect(handlers.get("package:switch")(null, "default-pet").animations.clips).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: animationId, name: "默认跳跃" })])
    );
  });

  it("keeps existing default package manifests unchanged when loading runtime rules", () => {
    const defaultPackageDir = path.join(userDataDir, "packages", "default-pet");
    fs.mkdirSync(path.join(defaultPackageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(defaultPackageDir, "assets", "idle.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(defaultPackageDir, "assets", "click.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(defaultPackageDir, "assets", "drag.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(defaultPackageDir, "manifest.json"), JSON.stringify({
      schemaVersion: "2.0.0",
      packageId: "default-pet",
      name: "default-pet",
      version: "1.0.0",
      animations: DEFAULT_CONFIG.animations,
      triggerRules: []
    }), "utf8");
    mockConfigStore.load.mockReturnValue({ currentPackageId: "default-pet" });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const runtime = handlers.get("pet:load-runtime")();
    const existingManifest = JSON.parse(fs.readFileSync(path.join(defaultPackageDir, "manifest.json"), "utf8"));

    expect(existingManifest.triggerRules).toEqual([]);
    expect(runtime.package.manifest.triggerRules).toEqual(existingManifest.triggerRules);
  });

  it("creates the missing default package from current bundled defaults", () => {
    mockConfigStore.load.mockReturnValue({ currentPackageId: "default-pet", triggerRules: [] });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const runtime = handlers.get("pet:load-runtime")();
    const manifest = JSON.parse(fs.readFileSync(path.join(userDataDir, "packages", "default-pet", "manifest.json"), "utf8"));

    expect(manifest.triggerRules).toEqual(DEFAULT_CONFIG.triggerRules);
    expect(runtime.package.manifest.triggerRules).toEqual(DEFAULT_CONFIG.triggerRules);
    expect(manifest.triggerRules).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "default-right-click-panel" })])
    );
  });

  it("creates a new package and switches the current config to it", () => {
    mockConfigStore.load.mockReturnValue({
      currentPackageId: "default-pet",
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: []
      },
      triggerRules: []
    });
    mockConfigStore.save.mockImplementation((config) => config);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const saved = handlers.get("package:create")(null, "my new pet");

    expect(saved.currentPackageId).toBe("my-new-pet");
    expect(fs.existsSync(path.join(userDataDir, "packages", "my-new-pet", "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, "packages", "my-new-pet", "assets"))).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, "packages", "my-new-pet", "assets", "idle.svg"))).toBe(true);
  });

  it("keeps Chinese characters when creating package ids", () => {
    mockConfigStore.load.mockReturnValue({
      currentPackageId: "default-pet",
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: []
      },
      triggerRules: []
    });
    mockConfigStore.save.mockImplementation((config) => config);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const saved = handlers.get("package:create")(null, "小猫 包");

    expect(saved.currentPackageId).toBe("小猫-包");
    expect(fs.existsSync(path.join(userDataDir, "packages", "小猫-包", "manifest.json"))).toBe(true);
  });

  it("switches packages with animations and rules from the package manifest", () => {
    const packageDir = path.join(userDataDir, "packages", "motion-pet");
    const animationId = "30000000-0000-4000-8000-000000000003";
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "assets", "idle.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify({
      schemaVersion: "2.0.0",
      packageId: "motion-pet",
      name: "Motion Pet",
      version: "1.0.0",
      animations: {
        default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.svg" },
        clips: [{ id: animationId, name: "Wave", asset: "assets/wave.svg", type: "oneshot", durationMs: 900 }]
      },
      triggerRules: [
        { id: "wave-rule", name: "Wave Rule", relation: "single", conditions: ["click"], actions: [{ type: "playAnimation", animation: animationId }] }
      ]
    }), "utf8");
    mockConfigStore.load.mockReturnValue({
      currentPackageId: "default-pet",
      animations: DEFAULT_CONFIG.animations,
      triggerRules: DEFAULT_CONFIG.triggerRules
    });
    mockConfigStore.save.mockImplementation((config) => config);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const saved = handlers.get("package:switch")(null, "motion-pet");

    expect(saved.currentPackageId).toBe("motion-pet");
    expect(saved.animations.clips[0]).toMatchObject({ id: animationId, name: "Wave" });
    expect(saved.triggerRules[0]).toMatchObject({ id: "wave-rule", name: "Wave Rule" });
  });

  it("persists saved package animations to the active package manifest", () => {
    const packageDir = path.join(userDataDir, "packages", "motion-pet");
    const animationId = "30000000-0000-4000-8000-000000000004";
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "assets", "idle.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "jump.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify({
      schemaVersion: "2.0.0",
      packageId: "motion-pet",
      name: "Motion Pet",
      version: "1.0.0",
      animations: {
        default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.svg" },
        clips: []
      },
      triggerRules: []
    }), "utf8");
    const savedPackageConfig = {
      currentPackageId: "motion-pet",
      animations: {
        default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.svg" },
        clips: [{ id: animationId, name: "Jump", asset: "assets/jump.svg", type: "oneshot", durationMs: 900 }]
      },
      triggerRules: [
        { id: "jump-rule", name: "Jump Rule", relation: "single", conditions: ["click"], actions: [{ type: "playAnimation", animation: animationId }] }
      ]
    };
    mockConfigStore.save.mockImplementation((config) => config);
    mockConfigStore.load.mockReturnValue(savedPackageConfig);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    handlers.get("config:save")(null, savedPackageConfig);
    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, "manifest.json"), "utf8"));

    expect(manifest.animations.clips[0]).toMatchObject({ id: animationId, name: "Jump" });
    expect(manifest.triggerRules[0]).toMatchObject({ id: "jump-rule", name: "Jump Rule" });
    expect(handlers.get("package:switch")(null, "motion-pet").animations.clips[0]).toMatchObject({
      id: animationId,
      name: "Jump"
    });
  });

  it("deletes pet packages from disk and switches current deleted packages to default", () => {
    const packageDir = path.join(userDataDir, "packages", "space-cat");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify({
      schemaVersion: "2.0.0",
      packageId: "space-cat",
      name: "space-cat",
      version: "1.0.0",
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: []
      },
      triggerRules: []
    }), "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.svg"), "<svg></svg>", "utf8");
    mockConfigStore.load.mockReturnValue({
      currentPackageId: "space-cat",
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: []
      },
      triggerRules: []
    });
    mockConfigStore.save.mockImplementation((config) => config);
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const result = handlers.get("package:delete")(null, "space-cat");

    expect(result).toEqual({ ok: true, packageId: "space-cat", currentPackageId: "default-pet" });
    expect(fs.existsSync(packageDir)).toBe(false);
    expect(mockConfigStore.save).toHaveBeenCalledWith(expect.objectContaining({
      currentPackageId: "default-pet"
    }));
    expect(handlers.get("package:delete")(null, "default-pet")).toEqual({
      ok: false,
      error: "Default package cannot be deleted"
    });
  });

  it("deletes package asset files through IPC", () => {
    const packageDir = path.join(userDataDir, "packages", "current-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "assets", "wave.webm"), "video", "utf8");
    mockConfigStore.load.mockReturnValue({ currentPackageId: "current-pet" });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const result = handlers.get("asset:delete")(null, {
      packageId: "current-pet",
      assetPath: "assets/wave.webm"
    });

    expect(result).toEqual({ ok: true, asset: "assets/wave.webm" });
    expect(fs.existsSync(path.join(packageDir, "assets", "wave.webm"))).toBe(false);
  });

  it("rejects asset imports for paths not picked by the same sender", async () => {
    const sourcePath = path.join(tempDir, "idle.svg");
    fs.writeFileSync(sourcePath, "<svg></svg>", "utf8");
    mockConfigStore.load.mockReturnValue({ currentPackageId: "current-pet" });
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [sourcePath] });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    await handlers.get("asset:pick")(createIpcEvent(7));
    const imported = handlers.get("asset:import")(createIpcEvent(8), {
      sourcePath,
      packageId: "current-pet"
    });

    expect(imported).toEqual({ ok: false, error: "Asset path was not selected" });
    expect(fs.existsSync(path.join(userDataDir, "packages", "current-pet", "assets", "idle.svg"))).toBe(false);
  });

  it("loads active package manifests with animation asset URLs and rejects unsafe package ids", async () => {
    const packageDir = path.join(userDataDir, "packages", "space-cat");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "assets", "idle.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify({
      schemaVersion: "2.0.0",
      packageId: "space-cat",
      name: "Space Cat",
      version: "1.0.0",
      animations: {
        default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.svg" },
        clips: [
          { id: WAVE_ID, name: "Wave", asset: "assets/wave.svg", type: "oneshot", durationMs: 900 }
        ]
      },
      triggerRules: []
    }), "utf8");
    mockConfigStore.load.mockReturnValue({
      currentPackageId: "space-cat",
      animations: {
        default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.svg" },
        clips: [{ id: WAVE_ID, name: "Wave", asset: "assets/wave.svg", type: "oneshot", durationMs: 900 }]
      },
      triggerRules: []
    });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const runtime = handlers.get("pet:load-runtime")();

    expect(runtime.config.currentPackageId).toBe("space-cat");
    expect(runtime.package.manifest.packageId).toBe("space-cat");
    expect(runtime.package.assetsByPath).toEqual({
      "assets/idle.svg": pathToFileURL(path.join(packageDir, "assets", "idle.svg")).href,
      "assets/wave.svg": pathToFileURL(path.join(packageDir, "assets", "wave.svg")).href
    });

    mockConfigStore.load.mockReturnValue({ currentPackageId: "../space-cat" });
    expect(handlers.get("pet:load-runtime")().package).toBeNull();
  });

  it("falls back when the active package manifest is missing or invalid", () => {
    const packageDir = path.join(userDataDir, "packages", "broken");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), "{", "utf8");
    mockConfigStore.load.mockReturnValue({ currentPackageId: "broken" });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    const runtime = handlers.get("pet:load-runtime")();

    expect(runtime.package).toBeNull();
    expect(runtime.packageError).toBe("Active package manifest is invalid");
  });

  it("broadcasts display updates and resets position through the pet window", () => {
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });
    handlers.get("pet:apply-display")(null, { scale: 1.25, opacity: 0.8 });
    handlers.get("pet:reset-position")(null, { x: 12, y: 24 });

    expect(petWindow.webContents.send).toHaveBeenCalledWith("pet:display-updated", {
      scale: 1.25,
      opacity: 0.8
    });
    expect(petWindow.setBounds).toHaveBeenCalledWith({ x: 12, y: 24, width: 320, height: 320 });
  });
});
