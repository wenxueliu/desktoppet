const { app, dialog, Menu, shell } = require("electron");
const { registerIpc } = require("./ipc");
const { createDesktopPetMenu, createMenuActions } = require("./menu");
const { createConfigStore } = require("./services/config-store");
const { importPetpack } = require("./services/petpack");
const { createTray } = require("./tray");
const { createPanelWindow, createPetWindow, getWindows } = require("./windows");

let configStore;
let menuActions;
let trayController;
let userDataDir;

function getPetWindow() {
  const { pet } = getWindows();
  return pet && !pet.isDestroyed() ? pet : null;
}

function getPanelWindow() {
  const { panel } = getWindows();
  return panel && !panel.isDestroyed() ? panel : null;
}

function notifyPackageChanged(payload) {
  const panelWindow = getPanelWindow();
  if (panelWindow && panelWindow.webContents) {
    panelWindow.webContents.send("package:changed", payload);
  }
}

async function importPetpackFromDialog() {
  const panelWindow = getPanelWindow();
  const dialogOptions = {
    properties: ["openFile"],
    filters: [
      { name: "Petpacks", extensions: ["petpack", "zip"] }
    ]
  };
  const result = panelWindow
    ? await dialog.showOpenDialog(panelWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return null;
  }

  const imported = await importPetpack(result.filePaths[0], userDataDir);
  if (imported && imported.ok && imported.packageId) {
    const config = configStore.load();
    configStore.save({
      ...config,
      currentPackageId: imported.packageId
    });
    notifyPackageChanged({ packageId: imported.packageId, reason: "import" });
  }

  return imported;
}

function refreshMenus() {
  if (trayController) {
    trayController.refresh();
  }
}

function createNativeMenu() {
  return createDesktopPetMenu({
    Menu,
    configStore,
    getWindows,
    actions: menuActions
  });
}

function openContextMenu() {
  const petWindow = getPetWindow();
  if (!petWindow) return;

  createNativeMenu().popup({ window: petWindow });
}

function hideDockIcon() {
  if (process.platform !== "darwin" || !app.dock || typeof app.dock.hide !== "function") {
    return;
  }

  app.dock.hide();
}

async function boot() {
  userDataDir = app.getPath("userData");
  configStore = createConfigStore(userDataDir);
  menuActions = createMenuActions({
    app,
    shell,
    configStore,
    getWindows,
    createPanelWindow,
    importPetpack: importPetpackFromDialog,
    userDataDir,
    refreshMenus
  });

  registerIpc({ getWindows, createPanelWindow, configStore, openContextMenu });
  await createPetWindow();
  await createPanelWindow({ show: false });
  trayController = createTray({
    createMenu: createNativeMenu
  });
  hideDockIcon();
}

app.whenReady().then(boot);

app.on("activate", async () => {
  const { pet } = getWindows();

  if (!pet || pet.isDestroyed()) {
    await createPetWindow();
    refreshMenus();
  }
});

app.on("before-quit", () => {
  if (trayController) {
    trayController.destroy();
  }
});
