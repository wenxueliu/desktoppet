/**
 * Asset and petpack handlers
 */

import { showBanner, hideBanner } from "../ui/banner.js";
import { getAssetPackageId } from "../tabs/assets.js";
import { removeConfigAssetReferences } from "../panel-state.js";

/**
 * Pick asset file
 * @param {object} api - API object
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function pickAsset(api, state, render) {
  if (!api || !api.assets || !api.assets.pick) {
    showBanner("Asset picker API is unavailable.");
    return;
  }

  try {
    const sourcePath = await api.assets.pick();
    if (!sourcePath) return;

    state.selectedAssetPath = sourcePath;
    state.selectedAssetResult = null;
    hideBanner();
    render();
  } catch (error) {
    showBanner(`Asset picker failed: ${error.message || error}`);
  }
}

/**
 * Import asset from form
 * @param {HTMLFormElement} form - Asset import form
 * @param {object} api - API object
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function importAssetFromForm(form, api, state, render, refreshPackagesAndAssets) {
  if (!api || !api.assets || !api.assets.import) {
    showBanner("Asset import API is unavailable.");
    return;
  }

  const formData = new FormData(form);
  const sourcePath = state.selectedAssetPath;
  const packageId = (state.config && state.config.currentPackageId) || "default-pet";
  const importName = String(formData.get("importName") || "").trim();

  state.selectedAssetPackageId = packageId;

  if (!sourcePath) {
    showBanner("Choose an asset file before importing.");
    return;
  }

  state.savingKey = "asset";
  render();

  try {
    const result = await api.assets.import(sourcePath, packageId, importName);
    state.selectedAssetResult = result;

    if (!result || !result.ok) {
      showBanner((result && result.error) || "Asset import failed.");
      render();
      return;
    }

    state.selectedPackageAsset = result.asset;
    if (refreshPackagesAndAssets) {
      await refreshPackagesAndAssets();
    }
    state.selectedAssetPath = "";
    state.selectedAssetResult = null;
    showBanner(`Imported ${result.asset}. Configure it in the Animations tab.`, "success");
  } catch (error) {
    state.selectedAssetResult = { ok: false, error: error.message || String(error) };
    showBanner(`Asset import failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

/**
 * Delete referenced asset
 * @param {string} assetPath - Asset path to delete
 * @param {object} api - API object
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function deleteReferencedAsset(assetPath, api, state, render) {
  if (!api || !api.assets || !api.assets.delete) {
    showBanner("Asset delete API is unavailable.");
    return;
  }

  state.savingKey = "asset-delete";
  render();

  try {
    const result = await api.assets.delete(assetPath, getAssetPackageId("", state.config));
    if (!result || !result.ok) {
      showBanner((result && result.error) || "Asset delete failed.");
      return;
    }

    await api.config.save(removeConfigAssetReferences(state.config, assetPath));
    state.config = await api.config.load();
    showBanner(`Deleted ${assetPath}.`, "success");
  } catch (error) {
    showBanner(`Asset delete failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

/**
 * Import petpack from picker
 * @param {object} api - API object
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function importPetpackFromPicker(api, state, render, refreshPackagesAndAssets) {
  if (!api || !api.petpack || !api.petpack.import) {
    showBanner("Petpack import API is unavailable.");
    return;
  }

  state.savingKey = "petpack-import";
  state.petpackResult = null;
  render();

  try {
    const result = await api.petpack.import();
    if (!result) {
      state.petpackResult = null;
      return;
    }

    state.petpackResult = result;
    if (!result.ok) {
      showBanner(result.error || "Petpack import failed.");
      return;
    }

    if (result.packageId) {
      const nextConfig = api.packages && api.packages.switch
        ? await api.packages.switch(result.packageId)
        : await api.config.save({
          ...state.config,
          currentPackageId: result.packageId
        });
      if (nextConfig && nextConfig.ok === false) {
        showBanner(nextConfig.error || "Package switch failed.");
        return;
      }
      state.config = nextConfig;
      state.selectedAssetPackageId = result.packageId;
    }

    if (refreshPackagesAndAssets) {
      await refreshPackagesAndAssets();
    }

    showBanner(`Imported ${result.packageId}.`, "success");
  } catch (error) {
    state.petpackResult = { ok: false, error: error.message || String(error) };
    showBanner(`Petpack import failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

/**
 * Export current petpack
 * @param {object} api - API object
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function exportCurrentPetpack(api, state, render, packageIdOverride = "") {
  if (!api || !api.petpack || !api.petpack.export) {
    showBanner("Petpack export API is unavailable.");
    return;
  }

  const packageId = packageIdOverride || (state.config && state.config.currentPackageId) || "default-pet";
  state.savingKey = "petpack-export";
  state.petpackResult = null;
  render();

  try {
    const result = await api.petpack.export(packageId);
    if (!result) {
      state.petpackResult = null;
      return;
    }

    state.petpackResult = result;
    if (!result.ok) {
      showBanner(result.error || "Petpack export failed.");
      return;
    }

    showBanner(`Exported ${result.packageId}.`, "success");
  } catch (error) {
    state.petpackResult = { ok: false, error: error.message || String(error) };
    showBanner(`Petpack export failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}
