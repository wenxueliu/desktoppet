const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, dialog, ipcMain } = require("electron");
const { createConfigStore } = require("./services/config-store");
const { copyAssetToPackage, deleteAssetFromPackage, getAssetDurationMs } = require("./services/asset-store");
const { exportPetpack, importPetpack } = require("./services/petpack");
const { getLaunchAtLogin, setLaunchAtLogin } = require("./startup");
const { validateManifest } = require("../shared/manifest-validator");
const { isSafeRelativePath } = require("../shared/path-safety");
const { SUPPORTED_ASSET_EXTENSIONS } = require("../shared/schema");
const { DEFAULT_CONFIG } = require("../shared/defaults");

const CHANNELS = [
  "asset:list",
  "asset:pick",
  "asset:import",
  "asset:delete",
  "config:load",
  "config:save",
  "menu:open-context-menu",
  "panel:show",
  "package:create",
  "package:delete",
  "package:list",
  "package:switch",
  "pet:apply-display",
  "pet:load-runtime",
  "pet:reset-position",
  "pet:get-runtime-state",
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
    .normalize("NFKC")
    .replace(/[\\/]+/g, "-")
    .replace(/[^\p{L}\p{N}._-]/gu, "-")
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
  const animations = (config && config.animations) || (manifest && manifest.animations) || {};
  addAssetReference(assetReferences, animations.default && animations.default.asset);
  if (Array.isArray(animations.clips)) {
    animations.clips.forEach((clip) => addAssetReference(assetReferences, clip && clip.asset));
  }

  return assetReferences;
}

function getBundledDefaultPackageDir() {
  return path.resolve(__dirname, "..", "assets", "default-pet");
}

function createPackageManifest(packageId, config = {}) {
  return {
    schemaVersion: "2.0.0",
    packageId,
    name: packageId,
    version: "1.0.0",
    animations: config.animations || DEFAULT_CONFIG.animations,
    triggerRules: Array.isArray(config.triggerRules) ? config.triggerRules : []
  };
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile()) {
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }
}

function ensurePackageDir(userDataDir, packageId, config = {}) {
  const packagesDir = path.join(userDataDir, "packages");
  const packageDir = path.join(packagesDir, packageId);
  const packageExists = fs.existsSync(packageDir);
  if (!isSafePackageId(packageId)) {
    return { ok: false, error: "Package ID is unsafe" };
  }

  if (!packageExists) {
    copyDirectory(getBundledDefaultPackageDir(), packageDir);
  }

  const manifestPath = path.join(packageDir, "manifest.json");
  const manifestConfig = packageId === "default-pet" && !packageExists ? DEFAULT_CONFIG : config;
  if (!fs.existsSync(manifestPath) || !packageExists) {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(createPackageManifest(packageId, manifestConfig), null, 2),
      "utf8"
    );
  }

  return { ok: true, packageDir, packagesDir };
}

function getPackageConfigFromManifest(packageDir, fallbackConfig = {}) {
  const manifestResult = readJsonFile(path.join(packageDir, "manifest.json"));
  if (!manifestResult.ok) return manifestResult;

  const manifest = manifestResult.value || {};
  return {
    ok: true,
    animations: manifest.animations || fallbackConfig.animations || DEFAULT_CONFIG.animations,
    triggerRules: Array.isArray(manifest.triggerRules)
      ? manifest.triggerRules
      : (Array.isArray(fallbackConfig.triggerRules) ? fallbackConfig.triggerRules : [])
  };
}

function loadPackageConfig(userDataDir, packageId, fallbackConfig = {}) {
  const ensured = ensurePackageDir(userDataDir, packageId, fallbackConfig);
  if (!ensured.ok) return ensured;
  const packageConfig = getPackageConfigFromManifest(ensured.packageDir, fallbackConfig);
  if (!packageConfig.ok) return packageConfig;
  return { ...packageConfig, packageDir: ensured.packageDir };
}

function saveConfigToActivePackageManifest(userDataDir, config) {
  const packageId = config && config.currentPackageId;
  if (typeof packageId !== "string" || !isSafePackageId(packageId)) {
    return;
  }

  const packagesDir = path.resolve(userDataDir, "packages");
  if (packageId === "default-pet") {
    const ensured = ensurePackageDir(userDataDir, packageId, config);
    if (!ensured.ok) return;
  }

  const packageDir = path.resolve(packagesDir, packageId);
  const relative = path.relative(packagesDir, packageDir);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(packageDir)) {
    return;
  }

  const manifestPath = path.join(packageDir, "manifest.json");
  const manifestResult = readJsonFile(manifestPath);
  const manifest = manifestResult.ok
    ? manifestResult.value
    : createPackageManifest(packageId, config);

  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      ...manifest,
      packageId,
      animations: config.animations || manifest.animations || DEFAULT_CONFIG.animations,
      triggerRules: Array.isArray(config.triggerRules) ? config.triggerRules : []
    }, null, 2),
    "utf8"
  );
}

function listPackages(userDataDir, currentPackageId) {
  const packagesDir = path.join(userDataDir, "packages");
  const packageIds = new Set(["default-pet"]);
  if (fs.existsSync(packagesDir)) {
    for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (entry.isDirectory() && isSafePackageId(entry.name)) {
        packageIds.add(entry.name);
      }
    }
  }
  return [...packageIds].sort().map((packageId) => ({
    packageId,
    isCurrent: packageId === currentPackageId,
    source: packageId === "default-pet" && !fs.existsSync(path.join(packagesDir, packageId)) ? "bundled" : "user"
  }));
}

function deletePackageDir(userDataDir, packageId) {
  if (packageId === "default-pet") {
    return { ok: false, error: "Default package cannot be deleted" };
  }
  if (!isSafePackageId(packageId)) {
    return { ok: false, error: "Package ID is unsafe" };
  }

  const packagesDir = path.resolve(userDataDir, "packages");
  const packageDir = path.resolve(packagesDir, packageId);
  const relative = path.relative(packagesDir, packageDir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { ok: false, error: "Package path is unsafe" };
  }
  if (!fs.existsSync(packageDir)) {
    return { ok: false, error: "Package does not exist" };
  }

  fs.rmSync(packageDir, { recursive: true, force: true });
  return { ok: true, packageId };
}

function listPackageAssets(userDataDir, packageId, config = {}) {
  const ensured = ensurePackageDir(userDataDir, packageId, config);
  if (!ensured.ok) return ensured;
  const assetsDir = path.join(ensured.packageDir, "assets");
  if (!fs.existsSync(assetsDir)) return { ok: true, assets: [] };

  const assets = [];
  for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_ASSET_EXTENSIONS.includes(ext)) continue;
    const asset = `assets/${entry.name}`;
    const absolutePath = path.join(assetsDir, entry.name);
    const durationMs = getAssetDurationMs(absolutePath, ext);
    assets.push({
      asset,
      name: entry.name,
      ext,
      url: getPackageAssetUrl(ensured.packageDir, asset),
      ...(durationMs ? { durationMs } : {})
    });
  }
  return { ok: true, assets: assets.sort((a, b) => a.asset.localeCompare(b.asset)) };
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

  if (packageId === "default-pet" && !fs.existsSync(packageDir)) {
    const ensured = ensurePackageDir(userDataDir, packageId, config);
    if (!ensured.ok) {
      return { package: null, packageError: ensured.error };
    }
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

  replaceHandler("package:list", () => {
    const loadedConfig = configStore.load();
    return {
      ok: true,
      packages: listPackages(userDataDir, loadedConfig.currentPackageId || "default-pet")
    };
  });
  replaceHandler("package:create", (_event, packageId) => {
    const loadedConfig = configStore.load();
    const nextPackageId = sanitizePackageId(packageId, "pet-package");
    const packageConfig = loadPackageConfig(userDataDir, nextPackageId, {
      ...DEFAULT_CONFIG,
      currentPackageId: nextPackageId
    });
    if (!packageConfig.ok) return packageConfig;
    const savedConfig = configStore.save({
      ...loadedConfig,
      currentPackageId: nextPackageId,
      animations: packageConfig.animations,
      triggerRules: packageConfig.triggerRules
    });
    sendRuntimeUpdate(getWindows, userDataDir, savedConfig);
    return savedConfig;
  });
  replaceHandler("package:delete", (_event, packageId) => {
    const loadedConfig = configStore.load();
    const selectedPackageId = sanitizePackageId(packageId, "");
    const deleted = deletePackageDir(userDataDir, selectedPackageId);
    if (!deleted.ok) return deleted;

    const shouldSwitchToDefault = loadedConfig.currentPackageId === selectedPackageId;
    const savedConfig = shouldSwitchToDefault
      ? (() => {
        const packageConfig = loadPackageConfig(userDataDir, "default-pet", loadedConfig);
        if (!packageConfig.ok) return packageConfig;
        return configStore.save({
          ...loadedConfig,
          currentPackageId: "default-pet",
          animations: packageConfig.animations,
          triggerRules: packageConfig.triggerRules
        });
      })()
      : loadedConfig;

    if (savedConfig && savedConfig.ok === false) return savedConfig;

    if (shouldSwitchToDefault) {
      sendRuntimeUpdate(getWindows, userDataDir, savedConfig);
    }

    return {
      ok: true,
      packageId: selectedPackageId,
      currentPackageId: savedConfig.currentPackageId || "default-pet"
    };
  });
  replaceHandler("package:switch", (_event, packageId) => {
    const loadedConfig = configStore.load();
    const nextPackageId = sanitizePackageId(packageId, loadedConfig.currentPackageId || "default-pet");
    const packageConfig = loadPackageConfig(userDataDir, nextPackageId, loadedConfig);
    if (!packageConfig.ok) return packageConfig;
    const savedConfig = configStore.save({
      ...loadedConfig,
      currentPackageId: nextPackageId,
      animations: packageConfig.animations,
      triggerRules: packageConfig.triggerRules
    });
    sendRuntimeUpdate(getWindows, userDataDir, savedConfig);
    return savedConfig;
  });
  replaceHandler("asset:list", (_event, packageId) => {
    const loadedConfig = configStore.load();
    const selectedPackageId = sanitizePackageId(packageId, loadedConfig.currentPackageId || "default-pet");
    return listPackageAssets(userDataDir, selectedPackageId, loadedConfig);
  });
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
    const ensured = ensurePackageDir(userDataDir, packageId, loadedConfig);
    if (!ensured.ok) return ensured;

    return copyAssetToPackage({
      sourcePath,
      packageDir: ensured.packageDir,
      importName: payload && payload.importName
    });
  });
  replaceHandler("asset:delete", (_event, payload) => {
    const loadedConfig = configStore.load();
    const packageId = sanitizePackageId(
      payload && payload.packageId,
      loadedConfig.currentPackageId || "default-pet"
    );
    const ensured = ensurePackageDir(userDataDir, packageId, loadedConfig);
    if (!ensured.ok) return ensured;
    return deleteAssetFromPackage({ packageDir: ensured.packageDir, assetPath: payload && payload.assetPath });
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

    const packageConfig = loadPackageConfig(userDataDir, selectedPackageId, loadedConfig);
    if (!packageConfig.ok) return packageConfig;
    return exportPetpack(selectedPackageId, userDataDir, result.filePath, {
      animations: packageConfig.animations,
      triggerRules: packageConfig.triggerRules
    });
  });
  replaceHandler("config:load", () => configStore.load());
  replaceHandler("config:save", (_event, config) => {
    const savedConfig = configStore.save(config);
    saveConfigToActivePackageManifest(userDataDir, savedConfig);
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

  // Runtime state query handler
  replaceHandler("pet:get-runtime-state", async () => {
    const petWindow = getPetWindow(getWindows);
    if (!petWindow || !petWindow.webContents) {
      return { ok: false, error: "Pet window not available" };
    }

    try {
      const state = await petWindow.webContents.executeJavaScript(
        "typeof window.__getPetRuntimeState === 'function' ? window.__getPetRuntimeState() : null"
      );
      return { ok: true, state };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // Runtime state push forwarder
  ipcMain.on("pet:push-runtime-state", (_event, state) => {
    const panelWindow = getPanelWindow(getWindows);
    if (panelWindow && panelWindow.webContents) {
      panelWindow.webContents.send("pet:runtime-state-updated", state);
    }
  });
}

module.exports = {
  CHANNELS,
  loadActivePackageRuntime,
  normalizeBounds,
  registerIpc,
  sanitizePackageId
};
