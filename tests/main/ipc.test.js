import { createRequire } from "node:module";
import fs from "node:fs";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const originalLoad = Module._load;

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

const electronMock = {
  app: {
    getPath,
    getLoginItemSettings,
    setLoginItemSettings,
    quit
  },
  dialog: {
    showOpenDialog
  },
  ipcMain: {
    handle: vi.fn((channel, handler) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel) => {
      handlers.delete(channel);
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
      packageId: "../bad/pet"
    });

    expect(pickedPath).toBe(sourcePath);
    expect(showOpenDialog).toHaveBeenCalledWith(panelWindow, expect.objectContaining({
      properties: ["openFile"]
    }));
    expect(imported).toEqual({ ok: true, asset: "assets/idle.svg" });
    expect(fs.existsSync(path.join(userDataDir, "packages", "-bad-pet", "assets", "idle.svg"))).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, "bad", "pet", "assets", "idle.svg"))).toBe(false);
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

  it("loads active package manifests with file URL assets and rejects unsafe package ids", async () => {
    const packageDir = path.join(userDataDir, "packages", "space-cat");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "assets", "idle.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.svg"), "<svg></svg>", "utf8");
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify({
      schemaVersion: "1",
      packageId: "space-cat",
      name: "Space Cat",
      version: "1.0.0",
      states: {
        idle: [{ id: "idle", asset: "assets/idle.svg" }]
      },
      actions: [
        { id: "wave", type: "playAnimation", asset: "assets/wave.svg", returnToState: "idle" }
      ],
      triggers: []
    }), "utf8");
    mockConfigStore.load.mockReturnValue({
      currentPackageId: "space-cat",
      customActions: [{ id: "custom-wave", type: "playAnimation", asset: "assets/wave.svg" }]
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
    handlers.get("pet:apply-display")(null, { scale: 1.25, opacity: 0.8, showHoverButtons: false });
    handlers.get("pet:reset-position")(null, { x: 12, y: 24 });

    expect(petWindow.webContents.send).toHaveBeenCalledWith("pet:display-updated", {
      scale: 1.25,
      opacity: 0.8,
      showHoverButtons: false
    });
    expect(petWindow.setBounds).toHaveBeenCalledWith({ x: 12, y: 24, width: 320, height: 320 });
  });
});
