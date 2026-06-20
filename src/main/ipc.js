const { app, ipcMain } = require("electron");
const { createConfigStore } = require("./services/config-store");

const CHANNELS = [
  "config:load",
  "config:save",
  "panel:show",
  "pet:set-always-on-top",
  "pet:set-mouse-passthrough",
  "pet:set-bounds",
  "app:quit"
];

function usableWindow(window) {
  return window && !window.isDestroyed();
}

function getPetWindow(getWindows) {
  const { pet } = getWindows();
  return usableWindow(pet) ? pet : null;
}

function getPanelWindow(getWindows) {
  const { panel } = getWindows();
  return usableWindow(panel) ? panel : null;
}

function normalizeBounds(bounds) {
  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds)) {
    throw new TypeError("Invalid pet bounds");
  }

  const nextBounds = {};
  for (const key of ["x", "y", "width", "height"]) {
    const value = bounds[key];
    if (!Number.isFinite(value)) {
      throw new TypeError("Invalid pet bounds");
    }
    nextBounds[key] = Math.round(value);
  }

  if (nextBounds.width <= 0 || nextBounds.height <= 0) {
    throw new TypeError("Invalid pet bounds");
  }

  return nextBounds;
}

function replaceHandler(channel, handler) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function registerIpc({ getWindows }) {
  const configStore = createConfigStore(app.getPath("userData"));

  replaceHandler("config:load", () => configStore.load());
  replaceHandler("config:save", (_event, config) => configStore.save(config));
  replaceHandler("panel:show", () => {
    const panelWindow = getPanelWindow(getWindows);
    if (panelWindow) {
      panelWindow.show();
      panelWindow.focus();
    }
  });
  replaceHandler("pet:set-always-on-top", (_event, enabled) => {
    const petWindow = getPetWindow(getWindows);
    if (petWindow) {
      petWindow.setAlwaysOnTop(Boolean(enabled));
    }
  });
  replaceHandler("pet:set-mouse-passthrough", (_event, enabled) => {
    const petWindow = getPetWindow(getWindows);
    if (petWindow) {
      petWindow.setIgnoreMouseEvents(Boolean(enabled), { forward: true });
    }
  });
  replaceHandler("pet:set-bounds", (_event, bounds) => {
    const nextBounds = normalizeBounds(bounds);
    const petWindow = getPetWindow(getWindows);
    if (petWindow) {
      petWindow.setBounds(nextBounds);
    }
  });
  replaceHandler("app:quit", () => app.quit());
}

module.exports = { CHANNELS, normalizeBounds, registerIpc };
