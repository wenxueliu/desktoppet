const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopPet", {
  version: "0.1.0"
});
