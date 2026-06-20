const path = require("path");
const { BrowserWindow } = require("electron");

let petWindow;
let panelWindow;

function rendererPath(name) {
  return path.join(__dirname, "..", "renderer", name, `${name}.html`);
}

async function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 320,
    height: 320,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "pet-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await petWindow.loadFile(rendererPath("pet"));
  return petWindow;
}

async function createPanelWindow({ show = true } = {}) {
  panelWindow = new BrowserWindow({
    width: 960,
    height: 680,
    show,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "panel-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await panelWindow.loadFile(rendererPath("panel"));
  return panelWindow;
}

function getWindows() {
  return { pet: petWindow, panel: panelWindow };
}

module.exports = { createPetWindow, createPanelWindow, getWindows };
