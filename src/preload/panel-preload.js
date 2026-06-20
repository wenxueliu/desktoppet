const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopPetPanel", {
  version: "0.1.0"
});
