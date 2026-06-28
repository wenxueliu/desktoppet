const path = require("path");
const { app, BrowserWindow } = require("electron");

let petWindow;
let panelWindow;

function rendererPath(name) {
  if (app.isPackaged) {
    return path.join(__dirname, "..", "..", "dist", "renderer", name, `${name}.html`);
  }

  return path.join(__dirname, "..", "renderer", name, `${name}.html`);
}

function attachDebugConsole(window, label) {
  if (!window || process.env.DESKTOP_PET_DEBUG_RULES !== "1") return;
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${label}:console:${level}] ${message} (${sourceId}:${line})`);
  });
}

async function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 320,
    height: 320,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "pet-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  attachDebugConsole(petWindow, "pet");

  petWindow.on("closed", () => {
    petWindow = null;
  });

  await petWindow.loadFile(rendererPath("pet"));
  return petWindow;
}

async function createPanelWindow({ show = true } = {}) {
  panelWindow = new BrowserWindow({
    width: 960,
    height: 680,
    show,
    skipTaskbar: process.platform === "win32",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "panel-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  panelWindow.on("closed", () => {
    panelWindow = null;
  });

  await panelWindow.loadFile(rendererPath("panel"));
  return panelWindow;
}

function getWindows() {
  return { pet: petWindow, panel: panelWindow };
}

module.exports = { createPetWindow, createPanelWindow, getWindows };
