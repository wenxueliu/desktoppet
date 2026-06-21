const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPetPanel", {
  version: "0.1.0",
  config: {
    load: () => ipcRenderer.invoke("config:load"),
    save: (config) => ipcRenderer.invoke("config:save", config)
  },
  assets: {
    pick: () => ipcRenderer.invoke("asset:pick"),
    import: (sourcePath, packageId) => ipcRenderer.invoke("asset:import", { sourcePath, packageId })
  },
  petpack: {
    import: () => ipcRenderer.invoke("petpack:import"),
    export: (packageId) => ipcRenderer.invoke("petpack:export", packageId)
  },
  pet: {
    applyDisplay: (display) => ipcRenderer.invoke("pet:apply-display", display),
    resetPosition: (position) => ipcRenderer.invoke("pet:reset-position", position),
    setMousePassthrough: (enabled) => ipcRenderer.invoke("pet:set-mouse-passthrough", enabled),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke("pet:set-always-on-top", enabled)
  },
  system: {
    getLaunchAtLogin: () => ipcRenderer.invoke("system:get-launch-at-login"),
    setLaunchAtLogin: (enabled) => ipcRenderer.invoke("system:set-launch-at-login", enabled)
  },
  app: {
    quit: () => ipcRenderer.invoke("app:quit")
  }
});
