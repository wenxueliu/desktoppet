/**
 * Animations tab
 */

import { escapeHtml, selected, getPathFilename } from "../ui/utils.js";
import { renderHeader } from "../ui/header.js";
import { t } from "../../../shared/i18n.js";

/**
 * Get animations from config
 * @param {object} config - Configuration object
 * @returns {object} Animations object with default and clips
 */
function getConfigAnimations(config) {
  const animations = config?.animations || {};
  return {
    default: animations.default || { id: "idle", asset: "" },
    clips: animations.clips || []
  };
}

/**
 * Render animation type selector
 * @param {string} currentType - Current animation type
 * @returns {string} HTML for type selector
 */
function renderTypeSelector(currentType) {
  const types = [
    { value: "oneshot", label: t("panel.animations.type.oneshot") },
    { value: "loop", label: t("panel.animations.type.loop") }
  ];

  return `
    <div class="form-group">
      <label for="anim-type">${t("panel.animations.form.type")}</label>
      <select id="anim-type" name="type" required>
        ${types.map(type => `
          <option value="${escapeHtml(type.value)}" ${selected(currentType, type.value)}>
            ${escapeHtml(type.label)}
          </option>
        `).join("")}
      </select>
    </div>
  `;
}

function getPackageAssets(state) {
  return Array.isArray(state.packageAssets) ? state.packageAssets : [];
}

function renderAssetSelector(currentAsset, packageAssets) {
  const hasCurrentAsset = currentAsset && !packageAssets.some((asset) => asset.asset === currentAsset);
  const options = [
    `<option value="">${t("panel.animations.form.assetPlaceholder")}</option>`,
    ...(hasCurrentAsset ? [`<option value="${escapeHtml(currentAsset)}" selected>${escapeHtml(currentAsset)}</option>`] : []),
    ...packageAssets.map((asset) => {
      const assetPath = asset.asset || "";
      const label = asset.name || getPathFilename(assetPath) || assetPath;
      return `
        <option value="${escapeHtml(assetPath)}" ${selected(currentAsset, assetPath)}>
          ${escapeHtml(label)} (${escapeHtml(assetPath)})
        </option>
      `;
    })
  ];

  return `
    <select id="anim-asset" name="asset" required>
      ${options.join("")}
    </select>
  `;
}

function renderHelpSection() {
  return `
    <section class="panel-section help-section">
      <div class="section-header"><h3>${t("panel.animations.help.title")}</h3></div>
      <div class="section-body help-content">
        <p><strong>${t("panel.animations.help.defaultTitle")}:</strong> ${t("panel.animations.help.defaultDesc")}</p>
        <p><strong>${t("panel.animations.help.oneshotTitle")}:</strong> ${t("panel.animations.help.oneshotDesc")}</p>
        <p><strong>${t("panel.animations.help.loopTitle")}:</strong> ${t("panel.animations.help.loopDesc")}</p>
        <p><strong>${t("panel.animations.help.assetTitle")}:</strong> ${t("panel.animations.help.assetDesc")}</p>
      </div>
    </section>
  `;
}

/**
 * Render animation card component
 * @param {object} clip - Animation clip
 * @param {boolean} isDefault - Whether this is the default animation
 * @param {boolean} isSelected - Whether this clip is selected
 * @returns {string} Animation card HTML
 */
function renderAnimationCard(clip, isDefault, isSelected) {
  const typeLabels = {
    default: t("panel.animations.type.default"),
    oneshot: t("panel.animations.type.oneshot"),
    loop: t("panel.animations.type.loop")
  };

  const typeLabel = typeLabels[clip.type] || clip.type;
  const title = isDefault ? `${clip.id} (${t("panel.animations.defaultAnimation")})` : clip.id;

  return `
    <button
      class="item-row asset-row"
      type="button"
      data-action="select-animation"
      data-clip-id="${escapeHtml(clip.id)}"
      aria-selected="${isSelected}"
      ${isDefault ? 'data-is-default="true"' : ''}
    >
      <span>
        <strong>${escapeHtml(title)}</strong>
        <code>${clip.asset ? escapeHtml(clip.asset) : t("panel.animations.noAsset")}</code>
      </span>
      <span class="muted">${escapeHtml(typeLabel)}${clip.durationMs ? ` · ${clip.durationMs}ms` : ""}</span>
    </button>
  `;
}

function renderAddAnimationRow() {
  return `
    <button class="item-row asset-row" type="button" data-action="add-animation">
      <span>
        <strong>+ ${t("panel.animations.addClip")}</strong>
        <code>${t("panel.animations.addClipDesc")}</code>
      </span>
    </button>
  `;
}

function renderSelectedSummary(formClip, isDefault) {
  const typeLabels = {
    default: t("panel.animations.type.default"),
    oneshot: t("panel.animations.type.oneshot"),
    loop: t("panel.animations.type.loop")
  };

  return `
    <div class="item-row">
      <div>
        <strong>${escapeHtml(formClip.id || t("panel.animations.addClip"))}</strong>
        <code>${formClip.asset ? escapeHtml(formClip.asset) : t("panel.animations.noAsset")}</code>
      </div>
      <span class="muted">${escapeHtml(typeLabels[isDefault ? "default" : formClip.type] || formClip.type || "")}</span>
    </div>
  `;
}

/**
 * Render animations tab
 * @param {object} state - Panel state
 * @param {object} config - Configuration object
 * @returns {string} Animations HTML
 */
export function renderAnimations(state, config) {
  const animations = getConfigAnimations(config);
  const selectedClipId = state.selectedClipId === undefined ? animations.default.id : state.selectedClipId;

  // Find selected clip
  let selectedClip;
  if (selectedClipId === "") {
    selectedClip = null;
  } else if (selectedClipId === animations.default.id) {
    selectedClip = { ...animations.default, type: "default" };
  } else {
    selectedClip = animations.clips.find(c => c.id === selectedClipId) || animations.clips[0];
  }

  // If no clip selected, default to default animation
  if (!selectedClip && selectedClipId !== "") {
    selectedClip = { ...animations.default, type: "default" };
  }

  const isDefault = Boolean(selectedClip && selectedClip.id === animations.default.id);
  const formClip = selectedClip || {
    id: "",
    asset: "",
    type: "oneshot",
    durationMs: 900
  };

  // Build clip list (default + clips)
  const allClips = [
    { ...animations.default, type: "default" },
    ...animations.clips
  ];
  const packageAssets = getPackageAssets(state);

  return `
    ${renderHeader(t("panel.animations.title"))}
    ${renderHelpSection()}

    <section class="panel-section">
      <div class="section-header">
        <h3>${t("panel.animations.title")}</h3>
        <span class="muted">${allClips.length}</span>
      </div>
      <div class="section-body">
        <div class="asset-browser">
          <div class="item-list" role="list">
            ${allClips.map(clip =>
              renderAnimationCard(
                clip,
                clip.id === animations.default.id,
                clip.id === selectedClipId
              )
            ).join("")}
            ${renderAddAnimationRow()}
          </div>

          <div class="asset-detail">
            ${renderSelectedSummary(formClip, isDefault)}
            <form id="animation-form" data-form-type="animation">
              <input type="hidden" name="clipId" value="${escapeHtml(formClip.id)}">
              <input type="hidden" name="isDefault" value="${isDefault}">

              <div class="form-group">
                <label for="anim-id">${t("panel.animations.form.id")}</label>
                <input
                  type="text"
                  id="anim-id"
                  name="id"
                  value="${escapeHtml(formClip.id)}"
                  required
                  pattern="[a-zA-Z0-9_-]+"
                  ${isDefault ? 'readonly' : ''}
                >
              </div>

              <div class="form-group">
                <label for="anim-asset">${t("panel.animations.form.asset")}</label>
                ${renderAssetSelector(formClip.asset || "", packageAssets)}
              </div>

              ${isDefault ? '' : renderTypeSelector(formClip.type || "oneshot")}

              ${isDefault || formClip.type === "loop" ? '' : `
                <div class="form-group" data-role="animation-duration">
                  <label for="anim-duration">${t("panel.animations.form.duration")}</label>
                  <input
                    type="number"
                    id="anim-duration"
                    name="durationMs"
                    value="${formClip.durationMs || 900}"
                    min="100"
                    max="10000"
                    step="100"
                  >
                </div>
              `}

              <div class="button-row">
                <button type="submit" class="button-primary">
                  ${t("common.save")}
                </button>
                ${isDefault ? '' : `
                  <button type="button" class="button-danger" data-action="delete-animation">
                    ${t("common.delete")}
                  </button>
                `}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  `;
}
