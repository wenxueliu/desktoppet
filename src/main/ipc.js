const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, dialog, ipcMain } = require("electron");
const { createConfigStore } = require("./services/config-store");
const { copyAssetToPackage, deleteAssetFromPackage } = require("./services/asset-store");
const { exportPetpack, importPetpack } = require("./services/petpack");
const { getLaunchAtLogin, setLaunchAtLogin } = require("./startup");
const { validateManifest } = require("../shared/manifest-validator");
const { isSafeRelativePath } = require("../shared/path-safety");
const { SUPPORTED_ASSET_EXTENSIONS } = require("../shared/schema");

const CHANNELS = [
  "asset:pick",
  "asset:import",
  "asset:delete",
  "config:load",
  "config:save",
  "menu:open-context-menu",
  "panel:show",
  "pet:apply-display",
  "pet:load-runtime",
  "pet:reset-position",
  "petpack:export",
  "petpack:import",
  "pet:set-always-on-top",
  "pet:set-mouse-passthrough",
  "pet:set-bounds",
  "system:get-launch-at-login",
  "system:set-launch-at-login",
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

function focusWindow(window) {
  if (usableWindow(window)) {
    window.focus();
  }
}

function sanitizePackageId(packageId, fallbackPackageId = "default-pet") {
  const fallback = typeof fallbackPackageId === "string" && fallbackPackageId.trim()
    ? fallbackPackageId
    : "default-pet";
  const rawValue = typeof packageId === "string" && packageId.trim() ? packageId : fallback;
  const sanitized = rawValue
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return sanitized || "default-pet";
}

function getSenderId(event) {
  return event && event.sender && event.sender.id;
}

function isSafePackageId(packageId) {
  return isSafeRelativePath(packageId) && !packageId.includes("/");
}

function collectPackageFiles(packageDir, currentDir = packageDir, files = []) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(packageDir, absolutePath).split(path.sep).join("/");

    if (!isSafeRelativePath(relativePath) || entry.isSymbolicLink()) {
      return { ok: false, error: "Active package contains unsafe entries" };
    }

    if (entry.isDirectory()) {
      const result = collectPackageFiles(packageDir, absolutePath, files);
      if (!result.ok) return result;
      continue;
    }

    if (!entry.isFile()) {
      return { ok: false, error: "Active package contains unsupported entries" };
    }

    files.push(relativePath);
  }

  return { ok: true, files };
}

function readJsonFile(filePath) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) };
  } catch (_error) {
    return { ok: false, error: "Active package manifest is invalid" };
  }
}

function addAssetReference(assetReferences, asset) {
  if (typeof asset === "string" && asset.trim()) {
    assetReferences.add(asset);
  }
}

function collectManifestAssetReferences(manifest, config) {
  const assetReferences = new Set();

  addAssetReference(assetReferences, manifest && manifest.preview);

  const states = manifest && manifest.states && typeof manifest.states === "object" ? manifest.states : {};
  for (const entries of Object.values(states)) {
    if (!Array.isArray(entries)) continue;
    entries.forEach((entry) => addAssetReference(assetReferences, entry && entry.asset));
  }

  const configStates = config && config.states && typeof config.states === "object" ? config.states : {};
  for (const entries of Object.values(configStates)) {
    if (!Array.isArray(entries)) continue;
    entries.forEach((entry) => addAssetReference(assetReferences, entry && (entry.asset || entry.assetPath)));
  }

  const manifestActions = Array.isArray(manifest && manifest.actions) ? manifest.actions : [];
  manifestActions.forEach((action) => addAssetReference(assetReferences, action && (action.asset || action.assetPath)));

  const customActions = Array.isArray(config && config.customActions) ? config.customActions : [];
  customActions.forEach((action) => addAssetReference(assetReferences, action && (action.asset || action.assetPath)));

  return assetReferences;
}

function getPackageAssetUrl(packageDir, asset) {
  if (!isSafeRelativePath(asset)) return "";

  const assetPath = path.resolve(packageDir, asset);
  const relative = path.relative(packageDir, assetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return "";
  if (!fs.existsSync(assetPath)) return "";

  const stats = fs.lstatSync(assetPath);
  if (!stats.isFile() || stats.isSymbolicLink()) return "";

  return pathToFileURL(assetPath).href;
}

function loadActivePackageRuntime(userDataDir, config) {
  const packageId = config && config.currentPackageId;
  if (typeof packageId !== "string" || !isSafePackageId(packageId)) {
    return { package: null, packageError: "Active package ID is invalid" };
  }

  const packagesDir = path.resolve(userDataDir, "packages");
  const packageDir = path.resolve(packagesDir, packageId);
  const relativePackageDir = path.relative(packagesDir, packageDir);
  if (relativePackageDir.startsWith("..") || path.isAbsolute(relativePackageDir)) {
    return { package: null, packageError: "Active package path is invalid" };
  }

  if (!fs.existsSync(packageDir)) {
    return { package: null, packageError: "Active package is unavailable" };
  }

  const collected = collectPackageFiles(packageDir);
  if (!collected.ok) {
    return { package: null, packageError: collected.error };
  }

  const manifestResult = readJsonFile(path.join(packageDir, "manifest.json"));
  if (!manifestResult.ok) {
    return { package: null, packageError: manifestResult.error };
  }

  const manifest = manifestResult.value;
  const validation = validateManifest(manifest, new Set(collected.files));
  if (!validation.ok || manifest.packageId !== packageId) {
    return { package: null, packageError: "Active package manifest is invalid" };
  }

  const assetsByPath = {};
  for (const asset of collectManifestAssetReferences(manifest, config)) {
    const url = getPackageAssetUrl(packageDir, asset);
    if (url) {
      assetsByPath[asset] = url;
    }
  }

  return {
    package: {
      packageId,
      manifest,
      assetsByPath
    },
    packageError: null
  };
}

function sendDisplayUpdate(getWindows, display) {
  const petWindow = getPetWindow(getWindows);
  if (petWindow && petWindow.webContents) {
    petWindow.webContents.send("pet:display-updated", display);
  }
}

function sendRuntimeUpdate(getWindows, userDataDir, config) {
  const petWindow = getPetWindow(getWindows);
  if (petWindow && petWindow.webContents) {
    petWindow.webContents.send("pet:runtime-updated", {
      config,
      ...loadActivePackageRuntime(userDataDir, config)
    });
  }
}

function registerIpc({ getWindows, createPanelWindow, configStore: injectedConfigStore, openContextMenu } = {}) {
  const userDataDir = app.getPath("userData");
  const configStore = injectedConfigStore || createConfigStore(userDataDir);
  const approvedAssetPathsBySender = new Map();

  replaceHandler("asset:pick", async (event) => {
    const panelWindow = getPanelWindow(getWindows);
    const dialogOptions = {
      properties: ["openFile"],
      filters: [
        {
          name: "Pet assets",
          extensions: SUPPORTED_ASSET_EXTENSIONS.map((extension) => extension.slice(1))
        }
      ]
    };
    const result = panelWindow
      ? await dialog.showOpenDialog(panelWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    const senderId = getSenderId(event);
    if (senderId !== undefined) {
      const approvedPaths = approvedAssetPathsBySender.get(senderId) || new Set();
      approvedPaths.add(selectedPath);
      approvedAssetPathsBySender.set(senderId, approvedPaths);
    }

    return selectedPath;
  });
  replaceHandler("asset:import", (event, payload) => {
    const sourcePath = payload && payload.sourcePath;
    const senderId = getSenderId(event);
    const approvedPaths = approvedAssetPathsBySender.get(senderId);
    if (!approvedPaths || !approvedPaths.has(sourcePath)) {
      return { ok: false, error: "Asset path was not selected" };
    }

    const loadedConfig = configStore.load();
    const packageId = sanitizePackageId(
      payload && payload.packageId,
      loadedConfig.currentPackageId || "default-pet"
    );
    const packageDir = path.join(userDataDir, "packages", packageId);

    return copyAssetToPackage({ sourcePath, packageDir });
  });
  replaceHandler("asset:delete", (_event, payload) => {
    const loadedConfig = configStore.load();
    const packageId = sanitizePackageId(
      payload && payload.packageId,
      loadedConfig.currentPackageId || "default-pet"
    );
    const packageDir = path.join(userDataDir, "packages", packageId);
    return deleteAssetFromPackage({ packageDir, assetPath: payload && payload.assetPath });
  });
  replaceHandler("petpack:import", async () => {
    const panelWindow = getPanelWindow(getWindows);
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

    return importPetpack(result.filePaths[0], userDataDir);
  });
  replaceHandler("petpack:export", async (_event, packageId) => {
    const loadedConfig = configStore.load();
    const selectedPackageId = typeof packageId === "string" && packageId.trim()
      ? packageId.trim()
      : loadedConfig.currentPackageId || "default-pet";
    const panelWindow = getPanelWindow(getWindows);
    const dialogOptions = {
      defaultPath: `${selectedPackageId}.petpack`,
      filters: [
        { name: "Petpack", extensions: ["petpack"] },
        { name: "Zip", extensions: ["zip"] }
      ]
    };
    const result = panelWindow
      ? await dialog.showSaveDialog(panelWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return null;
    }

    return exportPetpack(selectedPackageId, userDataDir, result.filePath, loadedConfig);
  });
  replaceHandler("config:load", () => configStore.load());
  replaceHandler("config:save", (_event, config) => {
    const savedConfig = configStore.save(config);
    sendRuntimeUpdate(getWindows, userDataDir, savedConfig);
    return savedConfig;
  });
  replaceHandler("menu:open-context-menu", () => {
    if (typeof openContextMenu === "function") {
      openContextMenu();
    }
  });
  replaceHandler("panel:show", async () => {
    const panelWindow = getPanelWindow(getWindows);
    if (panelWindow) {
      panelWindow.show();
      focusWindow(panelWindow);
      return;
    }

    const nextPanelWindow = await createPanelWindow({ show: true });
    focusWindow(nextPanelWindow);
  });
  replaceHandler("pet:load-runtime", () => {
    const config = configStore.load();
    return {
      config,
      ...loadActivePackageRuntime(userDataDir, config)
    };
  });
  replaceHandler("pet:apply-display", (_event, display) => {
    const nextDisplay = display && typeof display === "object" && !Array.isArray(display) ? display : {};
    sendDisplayUpdate(getWindows, nextDisplay);
  });
  replaceHandler("pet:reset-position", (_event, position = {}) => {
    const petWindow = getPetWindow(getWindows);
    if (!petWindow) return;

    const currentBounds = petWindow.getBounds();
    const x = Number.isFinite(position.x) ? Math.round(position.x) : currentBounds.x;
    const y = Number.isFinite(position.y) ? Math.round(position.y) : currentBounds.y;
    petWindow.setBounds({
      ...currentBounds,
      x,
      y
    });
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
  replaceHandler("system:get-launch-at-login", () => getLaunchAtLogin(app));
  replaceHandler("system:set-launch-at-login", (_event, enabled) => {
    const nextEnabled = Boolean(enabled);
    setLaunchAtLogin(app, nextEnabled);

    const config = configStore.load();
    configStore.save({
      ...config,
      system: {
        ...(config.system || {}),
        launchAtLogin: nextEnabled
      }
    });

    return nextEnabled;
  });
  replaceHandler("app:quit", () => app.quit());
}

module.exports = {
  CHANNELS,
  loadActivePackageRuntime,
  normalizeBounds,
  registerIpc,
  sanitizePackageId
};
