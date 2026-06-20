import { createRequire } from "node:module";
import Module from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

const electronMock = {
  app: {
    getPath,
    quit
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

describe("registerIpc", () => {
  let petWindow;
  let panelWindow;
  let recreatedPanelWindow;
  let getWindows;
  let createPanelWindow;

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

    petWindow = {
      isDestroyed: vi.fn(() => false),
      setAlwaysOnTop: vi.fn(),
      setIgnoreMouseEvents: vi.fn(),
      setBounds: vi.fn()
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

  it("registers config load and save handlers with the userData config store", async () => {
    mockConfigStore.load.mockReturnValue({ display: { x: 1 } });
    mockConfigStore.save.mockReturnValue({ display: { x: 2 } });
    const { registerIpc } = loadIpcModule();

    registerIpc({ getWindows, createPanelWindow });

    expect(createConfigStore).toHaveBeenCalledWith("/tmp/desktop-pet-user-data");
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
});
