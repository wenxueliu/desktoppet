const path = require("path");
const { app, BrowserWindow } = require("electron");
const { createLogger } = require("./services/logger");

let petWindow;
let panelWindow;
const logger = createLogger("windows");

function rendererPath(name) {
  if (app.isPackaged) {
    return path.join(__dirname, "..", "..", "dist", "renderer", name, `${name}.html`);
  }

  return path.join(__dirname, "..", "renderer", name, `${name}.html`);
}

function attachDebugConsole(window, label) {
  if (!window || process.env.DESKTOP_PET_DEBUG_RULES !== "1") return;
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    logger.debug(`renderer:${label}:console:${level}`, message, `${sourceId}:${line}`);
  });
}

async function createPetWindow() {
  logger.info("Creating pet window");
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
    logger.info("Pet window closed");
    petWindow = null;
  });

  await petWindow.loadFile(rendererPath("pet"));
  logger.info("Pet window loaded");
  return petWindow;
}

async function createPanelWindow({ show = true } = {}) {
  logger.info("Creating panel window", { show });
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
    logger.info("Panel window closed");
    panelWindow = null;
  });

  await panelWindow.loadFile(rendererPath("panel"));
  logger.info("Panel window loaded");
  return panelWindow;
}

function getWindows() {
  return { pet: petWindow, panel: panelWindow };
}

module.exports = { createPetWindow, createPanelWindow, getWindows };
