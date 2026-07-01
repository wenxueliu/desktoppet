/**
 * Asset and petpack handlers
 */

import { showBanner, hideBanner } from "../ui/banner.js";
import { getAssetPackageId } from "../tabs/assets.js";
import { removeConfigAssetReferences } from "../panel-state.js";
import { t } from "../../../shared/i18n.js";

function createOperationId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPathExtension(filePath) {
  const filename = String(filePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function isMovAsset(filePath) {
  return getPathExtension(filePath) === ".mov";
}

function setMovNotice(sourcePath, state) {
  state.assetProgress = isMovAsset(sourcePath)
    ? { stage: "notice", percent: null }
    : null;
}

/**
 * Pick asset file
 * @param {object} api - API object
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function pickAsset(api, state, render) {
  if (!api || !api.assets || !api.assets.pick) {
    showBanner(t("assets.import.pickerApiUnavailable"));
    return;
  }

  try {
    const sourcePath = await api.assets.pick();
    if (!sourcePath) return;

    state.selectedAssetPath = sourcePath;
    state.selectedAssetResult = null;
    setMovNotice(sourcePath, state);
    hideBanner();
    render();
  } catch (error) {
    showBanner(t("assets.import.pickerFailed", { reason: error.message || error }));
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
    showBanner(t("assets.import.apiUnavailable"));
    return;
  }

  const formData = new FormData(form);
  const sourcePath = state.selectedAssetPath;
  const packageId = (state.config && state.config.currentPackageId) || "default-pet";
  const importName = String(formData.get("importName") || "").trim();

  state.selectedAssetPackageId = packageId;

  if (!sourcePath) {
    showBanner(t("assets.import.chooseFileFirst"));
    return;
  }

  state.savingKey = "asset";
  state.assetProgress = {
    operationId: createOperationId("asset-import"),
    stage: isMovAsset(sourcePath) ? "converting" : "copying",
    percent: 0
  };
  render();

  try {
    const result = await api.assets.import(sourcePath, packageId, importName, state.assetProgress.operationId);
    state.selectedAssetResult = result;

    if (!result || !result.ok) {
      showBanner((result && result.error) || t("assets.import.error"));
      setMovNotice(sourcePath, state);
      render();
      return;
    }

    state.selectedPackageAsset = result.asset;
    if (refreshPackagesAndAssets) {
      await refreshPackagesAndAssets();
    }
    state.selectedAssetPath = "";
    state.selectedAssetResult = null;
    state.assetProgress = null;
    const conversionMessage = result.convertedFrom === ".mov"
      ? t("assets.import.movConverted")
      : "";
    showBanner(t("assets.import.successConfigure", { asset: result.asset, conversion: conversionMessage }), "success");
  } catch (error) {
    state.selectedAssetResult = { ok: false, error: error.message || String(error) };
    setMovNotice(sourcePath, state);
    showBanner(t("assets.import.failedWithReason", { reason: error.message || error }));
  } finally {
    state.savingKey = "";
    render();
  }
}

export async function selectAssetFromDrop(event, api, state, render) {
  const dropTarget = event.target && event.target.closest
    ? event.target.closest('[data-drop-target="import-asset"]')
    : null;
  if (!dropTarget) return false;

  event.preventDefault();
  event.stopPropagation();
  dropTarget.classList.remove("drag-over");

  if (!api || !api.assets || !api.assets.getDroppedFilePath) {
    showBanner(t("assets.drop.apiUnavailable"));
    return true;
  }

  const files = event.dataTransfer && event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];
  const file = files[0];
  if (!file) return true;

  const sourcePath = api.assets.getDroppedFilePath(file);
  if (!sourcePath) {
    showBanner(t("assets.drop.pathFailed"));
    return true;
  }

  state.selectedAssetPath = sourcePath;
  state.selectedAssetResult = null;
  setMovNotice(sourcePath, state);
  if (isMovAsset(sourcePath)) {
    showBanner(t("assets.import.movWillConvert"), "success");
  } else {
    hideBanner();
  }
  render();
  return true;
}

export async function replaceSelectedPackageAssetFromDrop(event, api, state, render, refreshPackagesAndAssets) {
  const dropTarget = event.target && event.target.closest
    ? event.target.closest('[data-drop-target="replace-package-asset"]')
    : null;
  if (!dropTarget) return false;

  event.preventDefault();
  event.stopPropagation();
  dropTarget.classList.remove("drag-over");

  if (!api || !api.assets || !api.assets.replace || !api.assets.getDroppedFilePath) {
    showBanner(t("assets.replace.apiUnavailable"));
    return true;
  }

  const targetAssetPath = state.selectedPackageAsset || dropTarget.dataset.asset;
  if (!targetAssetPath) {
    showBanner(t("assets.replace.selectFirst"));
    return true;
  }

  const files = event.dataTransfer && event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];
  const file = files[0];
  if (!file) {
    showBanner(t("assets.replace.dropOne"));
    return true;
  }

  const sourcePath = api.assets.getDroppedFilePath(file);
  if (!sourcePath) {
    showBanner(t("assets.drop.pathFailed"));
    return true;
  }

  const packageId = getAssetPackageId("", state.config);
  state.savingKey = "asset-replace";
  state.assetProgress = {
    operationId: createOperationId("asset-replace"),
    stage: isMovAsset(sourcePath) ? "converting" : "copying",
    percent: 0
  };
  render();

  try {
    const result = await api.assets.replace(sourcePath, packageId, targetAssetPath, state.assetProgress.operationId);
    if (!result || !result.ok) {
      showBanner((result && result.error) || t("assets.replace.failed"));
      return true;
    }

    if (refreshPackagesAndAssets) {
      await refreshPackagesAndAssets();
    }
    state.selectedPackageAsset = result.asset || targetAssetPath;
    const conversionMessage = result.convertedFrom === ".mov"
      ? t("assets.import.movConverted")
      : "";
    showBanner(t("assets.replace.success", { asset: state.selectedPackageAsset, conversion: conversionMessage }), "success");
  } catch (error) {
    showBanner(t("assets.replace.failedWithReason", { reason: error.message || error }));
  } finally {
    state.savingKey = "";
    state.assetProgress = null;
    render();
  }

  return true;
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
    showBanner(t("assets.delete.apiUnavailable"));
    return;
  }

  state.savingKey = "asset-delete";
  render();

  try {
    const result = await api.assets.delete(assetPath, getAssetPackageId("", state.config));
    if (!result || !result.ok) {
      showBanner((result && result.error) || t("assets.delete.failed"));
      return;
    }

    await api.config.save(removeConfigAssetReferences(state.config, assetPath));
    state.config = await api.config.load();
    showBanner(t("assets.delete.success", { asset: assetPath }), "success");
  } catch (error) {
    showBanner(t("assets.delete.failedWithReason", { reason: error.message || error }));
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
    showBanner(t("assets.petpack.importApiUnavailable"));
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
      showBanner(result.error || t("assets.petpack.importFailed"));
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
        showBanner(nextConfig.error || t("assets.package.switchFailed"));
        return;
      }
      state.config = nextConfig;
      state.selectedAssetPackageId = result.packageId;
    }

    if (refreshPackagesAndAssets) {
      await refreshPackagesAndAssets();
    }

    showBanner(t("assets.petpack.importSuccess", { packageId: result.packageId }), "success");
  } catch (error) {
    state.petpackResult = { ok: false, error: error.message || String(error) };
    showBanner(t("assets.petpack.importFailedWithReason", { reason: error.message || error }));
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
    showBanner(t("assets.petpack.exportApiUnavailable"));
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
      showBanner(result.error || t("assets.petpack.exportFailed"));
      return;
    }

    showBanner(result.targetPath
      ? t("assets.petpack.exportSuccess", { packageId: result.packageId, targetPath: result.targetPath })
      : t("assets.petpack.exportSuccessSimple", { packageId: result.packageId }), "success");
  } catch (error) {
    state.petpackResult = { ok: false, error: error.message || String(error) };
    showBanner(t("assets.petpack.exportFailedWithReason", { reason: error.message || error }));
  } finally {
    state.savingKey = "";
    render();
  }
}
