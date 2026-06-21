const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  version: "0.1.0",
  config: {
    load: () => ipcRenderer.invoke("config:load"),
    save: (config) => ipcRenderer.invoke("config:save", config)
  },
  panel: {
    show: () => ipcRenderer.invoke("panel:show")
  },
  menu: {
    openContextMenu: () => ipcRenderer.invoke("menu:open-context-menu")
  },
  pet: {
    loadRuntime: () => ipcRenderer.invoke("pet:load-runtime"),
    applyDisplay: (display) => ipcRenderer.invoke("pet:apply-display", display),
    resetPosition: (position) => ipcRenderer.invoke("pet:reset-position", position),
    setBounds: (bounds) => ipcRenderer.invoke("pet:set-bounds", bounds),
    setMousePassthrough: (enabled) => ipcRenderer.invoke("pet:set-mouse-passthrough", enabled),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke("pet:set-always-on-top", enabled),
    onSwitchState: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("pet:switch-state", listener);
      return () => ipcRenderer.removeListener("pet:switch-state", listener);
    },
    onRunAction: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, actionId) => callback(actionId);
      ipcRenderer.on("pet:run-action", listener);
      return () => ipcRenderer.removeListener("pet:run-action", listener);
    },
    onDisplayUpdated: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, display) => callback(display);
      ipcRenderer.on("pet:display-updated", listener);
      return () => ipcRenderer.removeListener("pet:display-updated", listener);
    },
    onInteractionsPaused: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, enabled) => callback(Boolean(enabled));
      ipcRenderer.on("pet:interactions-paused", listener);
      return () => ipcRenderer.removeListener("pet:interactions-paused", listener);
    }
  }
});
