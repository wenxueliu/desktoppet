/**
 * Desktop Pet Control Panel
 * Main entry point and orchestration
 */

import { t, setLocale, initLocale } from "../../shared/i18n.js";
import { state } from "./state.js";
import { initBanner, showBanner, hideBanner } from "./ui/banner.js";
import { renderTabs } from "./ui/tabs.js";
import { renderOverview } from "./tabs/overview.js";
import { renderAssets } from "./tabs/assets.js";
import { renderAnimations } from "./tabs/animations.js";
import { renderRules } from "./tabs/rules.js";
import { renderDisplay } from "./tabs/display.js";
import { renderSystem } from "./tabs/system.js";
import { handleFormSubmit } from "./handlers/form-handlers.js";
import { handleTabClick, handleInput, handleChange, handleClickAction } from "./handlers/event-handlers.js";
import { importAssetFromForm } from "./handlers/asset-handlers.js";

// Initialize locale from config or browser
initLocale();

// API and DOM references
const api = window.desktopPetPanel;
const tabsEl = document.querySelector("#tabs");
const rootEl = document.querySelector("#panel-root");
const bannerEl = document.querySelector("#banner");
const versionEl = document.querySelector("#panel-version");

// Initialize banner
initBanner(bannerEl);

// Set version
versionEl.textContent = api && api.version ? `v${api.version}` : "preload unavailable";

/**
 * Load configuration from API
 * @returns {Promise<void>}
 */
async function loadConfig() {
  if (!api || !api.config || !api.config.load) {
    showBanner("Panel preload API is unavailable.");
    return;
  }

  try {
    state.config = await api.config.load();
    await refreshPackagesAndAssets();

    // Initialize locale from config
    if (state.config.system?.language) {
      setLocale(state.config.system.language);
    }

    // Update page title
    const titleEl = document.querySelector("#page-title");
    if (titleEl) {
      titleEl.textContent = t("panel.title");
    }

    if (api.system && api.system.getLaunchAtLogin) {
      state.systemLaunchAtLogin = await api.system.getLaunchAtLogin();
    } else {
      state.systemLaunchAtLogin = Boolean(state.config.system && state.config.system.launchAtLogin);
    }
    hideBanner();
  } catch (error) {
    showBanner(`Could not load config: ${error.message || error}`);
  } finally {
    render();
  }
}

async function refreshPackagesAndAssets() {
  if (!api || !state.config) return;
  const packageId = state.config.currentPackageId || "default-pet";
  if (api.packages && api.packages.list) {
    const result = await api.packages.list();
    state.packageList = result && result.ok ? result.packages : [];
  }
  if (api.assets && api.assets.list) {
    const result = await api.assets.list(packageId);
    state.packageAssets = result && result.ok ? result.assets : [];
    if (!state.selectedPackageAsset || !state.packageAssets.some((asset) => asset.asset === state.selectedPackageAsset)) {
      state.selectedPackageAsset = state.packageAssets[0]?.asset || "";
    }
  }
}

async function refreshAfterPackageChange(payload = {}) {
  if (!api || !api.config || !api.config.load) return;

  try {
    if (payload.packageId && api.packages && api.packages.switch) {
      const nextConfig = await api.packages.switch(payload.packageId);
      if (nextConfig && nextConfig.ok === false) {
        showBanner(nextConfig.error || "Package switch failed.");
        return;
      }
      state.config = nextConfig;
    } else {
      state.config = await api.config.load();
    }
    await refreshPackagesAndAssets();
    render();
  } catch (error) {
    showBanner(`Package refresh failed: ${error.message || error}`);
  }
}

/**
 * Save configuration via API
 * @param {object} nextConfig - Configuration to save
 * @param {string} key - Saving key for UI state
 * @returns {Promise<object|null>} Saved config or null
 */
async function saveConfig(nextConfig, key) {
  if (state.savingKey) return null;
  state.savingKey = key;

  try {
    const savedConfig = await api.config.save(nextConfig);
    state.config = savedConfig;
    state.savingKey = "";
    showBanner("Saved.", "success");
    render();
    return savedConfig;
  } catch (error) {
    showBanner(`Save failed: ${error.message || error}`);
    return null;
  } finally {
    if (state.savingKey === key) {
      state.savingKey = "";
    }
  }
}

/**
 * Render current view
 */
function render() {
  renderTabs(state.activeTab, tabsEl);

  if (!state.config) {
    rootEl.innerHTML = `<div class="empty-state">Loading configuration...</div>`;
    return;
  }

  const views = {
    overview: () => renderOverview(state.config),
    assets: () => renderAssets(state, state.config),
    animations: () => renderAnimations(state, state.config),
    rules: () => renderRules(state, state.config),
    display: () => renderDisplay(state, state.config),
    system: () => renderSystem(state, state.config)
  };

  rootEl.innerHTML = views[state.activeTab]();
}

// Event listeners
tabsEl.addEventListener("click", (event) => handleTabClick(event, state, render));

rootEl.addEventListener("input", handleInput);

rootEl.addEventListener("change", async (event) => {
  await handleChange(event, state, api, render);
});

rootEl.addEventListener("click", async (event) => {
  await handleClickAction(event, state, api, saveConfig, render, refreshPackagesAndAssets);
});

rootEl.addEventListener("submit", async (event) => {
  await handleFormSubmit(
    event,
    state,
    state.config,
    saveConfig,
    render,
    api,
    (form) => importAssetFromForm(form, api, state, render, refreshPackagesAndAssets)
  );
});

if (api && api.events && api.events.onPackageChanged) {
  api.events.onPackageChanged(refreshAfterPackageChange);
}

// Initialize
render();
loadConfig();
