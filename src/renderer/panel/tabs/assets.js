/**
 * Assets tab
 */

import { escapeHtml, disabled as disabledHelper, getPathFilename, getPathExtension, toFilePreviewUrl } from "../ui/utils.js";
import { renderHeader } from "../ui/header.js";
import { t } from "../../../shared/i18n.js";

const IMAGE_ASSET_EXTENSIONS = [".gif", ".webp", ".png", ".svg"];
const VIDEO_ASSET_EXTENSIONS = [".webm", ".mp4", ".mov"];

/**
 * Get asset package ID
 * @param {string} selectedPackageId - Selected package ID
 * @param {object} config - Configuration object
 * @returns {string} Package ID
 */
export function getAssetPackageId(selectedPackageId, config) {
  return selectedPackageId || (config && config.currentPackageId) || "default-pet";
}

/**
 * Get all referenced assets from animations
 * @param {object} animations - Animations object
 * @returns {string[]} Sorted array of asset paths
 */
export function getReferencedAssets(animations) {
  const assets = new Set();

  if (animations) {
    // Add default animation asset
    if (animations.default && animations.default.asset) {
      assets.add(animations.default.asset);
    }

    // Add clip assets
    if (Array.isArray(animations.clips)) {
      animations.clips.forEach((clip) => {
        if (clip && clip.asset) {
          assets.add(clip.asset);
        }
      });
    }
  }

  return [...assets].sort();
}

/**
 * Render asset preview component
 * @param {string} sourcePath - Asset file path
 * @param {string} ext - File extension
 * @returns {string} Preview HTML
 */
function renderAssetPreview(sourcePath, ext) {
  if (!sourcePath) {
    return `<div class="empty-state compact">${t("assets.referenced.preview")}</div>`;
  }

  const src = toFilePreviewUrl(sourcePath);
  if (IMAGE_ASSET_EXTENSIONS.includes(ext)) {
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(getPathFilename(sourcePath))}">`;
  }

  if (VIDEO_ASSET_EXTENSIONS.includes(ext)) {
    return `<video src="${escapeHtml(src)}" controls muted loop playsinline></video>`;
  }

  return `<div class="empty-state compact">Preview unavailable for ${escapeHtml(ext || "this file")}.</div>`;
}

/**
 * Render asset import result
 * @param {object} result - Import result
 * @returns {string} Result HTML
 */
function renderAssetResult(result) {
  const ok = result && result.ok;
  const message = ok
    ? `Imported ${result.asset}.`
    : (result && result.error) || "Import failed.";

  return `<div class="asset-result ${ok ? "success" : "error"}">${escapeHtml(message)}</div>`;
}

/**
 * Render petpack operation result
 * @param {object} result - Operation result
 * @returns {string} Result HTML
 */
function renderPetpackResult(result) {
  const ok = result && result.ok;
  const message = ok
    ? (result.targetPath
      ? `Exported ${result.packageId} to ${result.targetPath}.`
      : `Imported ${result.packageId}.`)
    : (result && result.error) || "Petpack operation failed.";

  return `<div class="asset-result ${ok ? "success" : "error"}">${escapeHtml(message)}</div>`;
}

/**
 * Render assets tab
 * @param {object} state - Panel state
 * @param {object} config - Configuration object
 * @returns {string} Assets HTML
 */
export function renderAssets(state, config) {
  const sourcePath = state.selectedAssetPath;
  const sourceName = getPathFilename(sourcePath);
  const ext = getPathExtension(sourcePath);
  const result = state.selectedAssetResult;
  const petpackResult = state.petpackResult;
  const currentPackageId = (config && config.currentPackageId) || "default-pet";
  const canImport = sourcePath;
  const animations = config?.animations || { default: { id: "idle", asset: "" }, clips: [] };
  const referencedAssets = getReferencedAssets(animations);
  const disabled = (key) => disabledHelper(key, state.savingKey);

  return `
    ${renderHeader(t("assets.title"), t("assets.description"))}
    <section class="panel-section">
      <div class="section-header"><h3>${t("assets.import.title")}</h3></div>
      <div class="section-body">
        <form id="asset-import-form">
          <div class="asset-grid">
            <div class="asset-preview">
              ${renderAssetPreview(sourcePath, ext)}
            </div>
            <div class="asset-controls">
              <div class="form-actions flush">
                <button type="button" data-action="pick-asset">${t("assets.import.chooseFile")}</button>
                <button class="button-primary" type="submit" ${canImport ? "" : "disabled"} ${disabled("asset")}>${state.savingKey === "asset" ? t("common.importing") : t("assets.import.button")}</button>
              </div>
              <div class="field">
                <span class="field-label">${t("assets.import.selectedFile")}</span>
                ${sourcePath ? `
                  <strong>${escapeHtml(sourceName)}</strong>
                  <code class="code-line breakable">${escapeHtml(sourcePath)}</code>
                ` : `<span class="muted">${t("assets.import.noFileSelected")}</span>`}
              </div>
              <div class="field">
                <label for="asset-package-id">${t("assets.import.package")}</label>
                <input id="asset-package-id" name="packageId" type="text" value="${escapeHtml(getAssetPackageId(state.selectedAssetPackageId, config))}">
              </div>
              ${result ? renderAssetResult(result) : ""}
            </div>
          </div>
        </form>
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${t("assets.petpack.title")}</h3></div>
      <div class="section-body">
        <div class="form-actions flush">
          <button type="button" data-action="import-petpack" ${disabled("petpack-import")}>${state.savingKey === "petpack-import" ? t("common.importing") : t("assets.petpack.import")}</button>
          <button type="button" data-action="export-petpack" ${disabled("petpack-export")}>${state.savingKey === "petpack-export" ? t("common.exporting") : t("assets.petpack.export")}</button>
        </div>
        <p class="muted">${t("assets.petpack.currentPackage")} ${escapeHtml(currentPackageId)}</p>
        ${petpackResult ? renderPetpackResult(petpackResult) : ""}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${t("assets.referenced.title")}</h3><span class="muted">${referencedAssets.length === 1 ? t("assets.referenced.count", {count: referencedAssets.length}) : t("assets.referenced.countPlural", {count: referencedAssets.length})}</span></div>
      <div class="section-body">
        ${referencedAssets.length ? `<div class="item-list">${referencedAssets.map((asset) => `
          <div class="item-row">
            <div><code>${escapeHtml(asset)}</code></div>
            <button type="button" data-action="delete-asset" data-asset="${escapeHtml(asset)}">${t("common.delete")}</button>
          </div>
        `).join("")}</div>` : `<div class="empty-state">${t("assets.referenced.empty")}</div>`}
      </div>
    </section>
  `;
}
