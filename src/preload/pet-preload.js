const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  version: "0.1.0",
  debugRules: process.env.DESKTOP_PET_DEBUG_RULES === "1",
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
  logs: {
    write: (level, scope, message, data) => ipcRenderer.send("log:write", { level, scope, message, data })
  },
  pet: {
    loadRuntime: () => ipcRenderer.invoke("pet:load-runtime"),
    getDisplays: () => ipcRenderer.invoke("pet:get-displays"),
    applyDisplay: (display) => ipcRenderer.invoke("pet:apply-display", display),
    resetPosition: (position) => ipcRenderer.invoke("pet:reset-position", position),
    setBounds: (bounds) => ipcRenderer.invoke("pet:set-bounds", bounds),
    setMousePassthrough: (enabled) => ipcRenderer.invoke("pet:set-mouse-passthrough", enabled),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke("pet:set-always-on-top", enabled),
    onPlayAnimation: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, animationId) => callback(animationId);
      ipcRenderer.on("pet:play-animation", listener);
      return () => ipcRenderer.removeListener("pet:play-animation", listener);
    },
    onDisplayUpdated: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, display) => callback(display);
      ipcRenderer.on("pet:display-updated", listener);
      return () => ipcRenderer.removeListener("pet:display-updated", listener);
    },
    onRuntimeUpdated: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, runtime) => callback(runtime);
      ipcRenderer.on("pet:runtime-updated", listener);
      return () => ipcRenderer.removeListener("pet:runtime-updated", listener);
    },
    onInteractionsPaused: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, enabled) => callback(Boolean(enabled));
      ipcRenderer.on("pet:interactions-paused", listener);
      return () => ipcRenderer.removeListener("pet:interactions-paused", listener);
    },
    pushRuntimeState: (state) => ipcRenderer.send("pet:push-runtime-state", state),
    onGlobalMouseMove: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("pet:global-mouse-move", listener);
      return () => ipcRenderer.removeListener("pet:global-mouse-move", listener);
    }
  }
});
