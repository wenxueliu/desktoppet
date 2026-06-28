/**
 * Click and change event handlers
 */

import { escapeHtml } from "../ui/utils.js";
import { t } from "../../../shared/i18n.js";
import { setLocale } from "../../../shared/i18n.js";
import {
  getFieldsForCondition,
  deleteConfigRule,
  updateConfigRule,
  updateConfigSystem,
  DEFAULT_KEYFRAMES,
  normalizeKeyframes,
  updateConfigAnimationKeyframes
} from "../panel-state.js";
import { renderRuleConditionEditor } from "../components/rule-condition-editor.js";
import { getFieldLabel } from "../components/rule-condition-editor.js";
import { renderSingleInlineAction } from "../components/inline-action-editor.js";
import { showBanner } from "../ui/banner.js";
import { getAssetReferences } from "../tabs/assets.js";
import { updateConfigSystem as updateSysConfig } from "../panel-state.js";
import {
  pickAsset,
  deleteReferencedAsset,
  importPetpackFromPicker,
  exportCurrentPetpack
} from "./asset-handlers.js";
import { resetPosition, deleteAnimation } from "./form-handlers.js";

/**
 * Set launch at login
 * @param {boolean} enabled - Enable launch at login
 * @param {object} api - API object
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
async function setLaunchAtLogin(enabled, api, state, render) {
  if (!api || !api.system || !api.system.setLaunchAtLogin) {
    showBanner("Startup API is unavailable.");
    render();
    return;
  }

  state.savingKey = "system";
  render();

  try {
    state.systemLaunchAtLogin = await api.system.setLaunchAtLogin(enabled);
    if (state.config) {
      state.config = updateSysConfig(state.config, { launchAtLogin: state.systemLaunchAtLogin });
    }
    showBanner("Saved.", "success");
  } catch (error) {
    showBanner(`Startup setting failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

const VIDEO_ASSET_EXTENSIONS = new Set([".webm", ".mp4", ".mov"]);

function getDatasetDurationMs(element) {
  const durationMs = Number(element?.dataset?.durationMs);
  return Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0;
}

function readVideoDurationMs(url) {
  if (!url || typeof document === "undefined") return Promise.resolve(0);

  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };
    const finish = (durationMs = 0) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      resolve(durationMs);
    };
    const timeoutId = setTimeout(() => finish(0), 5000);

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration) && video.duration > 0
        ? Math.round(video.duration * 1000)
        : 0;
      finish(durationMs);
    };
    video.onerror = () => finish(0);
    video.src = url;
    video.load();
  });
}

async function getSelectedAssetDurationMs(option) {
  const listedDurationMs = getDatasetDurationMs(option);
  if (listedDurationMs) return listedDurationMs;

  const ext = option?.dataset?.ext || "";
  const url = option?.dataset?.url || "";
  if (!VIDEO_ASSET_EXTENSIONS.has(ext)) return 0;

  return readVideoDurationMs(url);
}

async function applySelectedAssetDuration(select) {
  const form = select?.closest("form");
  const typeSelect = form && form.querySelector("#anim-type");
  if (typeSelect && typeSelect.value !== "oneshot") return;

  const input = form && form.querySelector('[data-role="animation-duration"] input[name="durationMs"]');
  if (!input) return;

  const selectedValue = select.value;
  const option = select.options[select.selectedIndex];
  const durationMs = await getSelectedAssetDurationMs(option);
  if (!durationMs || select.value !== selectedValue) return;

  input.value = String(durationMs);
}

function getSelectedClipId(state) {
  if (state.selectedClipId !== undefined) return state.selectedClipId;
  return state.config?.animations?.default?.id || "";
}

function findCurrentClip(state, clipId) {
  const animations = state.config?.animations || { default: { id: "idle", asset: "" }, clips: [] };
  if (clipId && clipId === animations.default?.id) return animations.default;
  return (animations.clips || []).find((clip) => clip && clip.id === clipId) || null;
}

function updateAnimationDraftFromForm(form, state) {
  if (!form) return null;
  const selectedClipId = getSelectedClipId(state);
  const currentClip = findCurrentClip(state, selectedClipId);
  const existingDraft = state.animationDraft && state.animationDraft.selectedClipId === selectedClipId
    ? state.animationDraft.clip
    : {};
  const type = form.elements.type ? form.elements.type.value : (currentClip?.type || "oneshot");
  const nextClip = {
    id: String(form.elements.id?.value || currentClip?.id || ""),
    name: String(form.elements.name?.value || ""),
    asset: String(form.elements.asset?.value || ""),
    type,
    durationMs: form.elements.durationMs?.value ? Number(form.elements.durationMs.value) : (currentClip?.durationMs || 900)
  };

  if (type === "keyframe") {
    nextClip.keyframes = normalizeKeyframes(existingDraft.keyframes || currentClip?.keyframes || DEFAULT_KEYFRAMES);
  }

  state.animationDraft = {
    selectedClipId,
    clip: nextClip
  };
  return state.animationDraft;
}

/**
 * Handle tab clicks
 * @param {Event} event - Click event
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 */
export function handleTabClick(event, state, render) {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  state.activeTab = button.dataset.tab;
  render();
}

/**
 * Handle input events (for live updates)
 * @param {Event} event - Input event
 */
export function handleInput(event, state, render) {
  if (event.target.id === "display-scale") {
    document.querySelector("#scale-value").textContent = `${event.target.value}%`;
  }
  if (event.target.id === "display-opacity") {
    document.querySelector("#opacity-value").textContent = `${event.target.value}%`;
  }
}

/**
 * Handle change events
 * @param {Event} event - Change event
 * @param {object} state - Panel state
 * @param {object} api - API object
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function handleChange(event, state, api, render) {
  if (event.target.id === "state-type") {
    state.selectedStateType = event.target.value;
    state.selectedStateEntryId = "";
    render();
    return;
  }

  if (event.target.id === "asset-binding-target") {
    state.selectedAssetBindingTarget = event.target.value;
    render();
    return;
  }

  if (event.target.id === "asset-action-id") {
    state.selectedAssetActionId = event.target.value;
    return;
  }

  if (event.target.id === "asset-package-id") {
    state.selectedAssetPackageId = event.target.value;
    return;
  }

  if (event.target.id === "anim-type") {
    const form = event.target.closest("form");
    updateAnimationDraftFromForm(form, state);
    if (event.target.value === "oneshot") {
      const assetSelect = form && form.querySelector("#anim-asset");
      if (assetSelect) await applySelectedAssetDuration(assetSelect);
    }
    render();
    return;
  }

  if (event.target.id === "anim-asset") {
    updateAnimationDraftFromForm(event.target.closest("form"), state);
    await applySelectedAssetDuration(event.target);
    return;
  }

  if (event.target.id === "launch-at-login") {
    await setLaunchAtLogin(event.target.checked, api, state, render);
    return;
  }

  // Handle rule relation selectors - show/hide time window field per condition scope
  if (event.target.dataset.role === "condition-relation") {
    const form = event.target.closest("form");
    const relation = event.target.value;
    const scope = event.target.dataset.scope || "conditions";
    const windowField = form && form.querySelector(`[data-role="and-window-field"][data-scope="${scope}"]`);
    const addConditionBtn = form && form.querySelector(`[data-action="add-rule-condition"][data-scope="${scope}"]`);
    const conditionsList = form && form.querySelector(`.conditions-list[data-scope="${scope}"]`);

    if (windowField) {
      windowField.style.display = relation === "and" ? "" : "none";
    }

    const relationHelp = form && form.querySelector(scope === "exitConditions" ? '[data-role="exit-relation-help"]' : '[data-role="relation-help"]');
    if (relationHelp) {
      const helpText = t(`rules.relationHint.${relation}`);
      const summary = relationHelp.querySelector("summary");
      const popover = relationHelp.querySelector(".field-help-popover");
      if (summary) {
        summary.setAttribute("aria-label", helpText);
      }
      if (popover) {
        popover.textContent = helpText;
      }
    }

    if (addConditionBtn && conditionsList) {
      const conditionCount = conditionsList.querySelectorAll(`[data-rule-condition][data-scope="${scope}"]`).length;
      const helpRow = addConditionBtn.closest(".add-condition-row") || addConditionBtn.parentNode;
      const existingHint = helpRow.querySelector('[data-help="single-mode"]');

      if (relation === "single" && conditionCount >= 1) {
        addConditionBtn.disabled = true;
        if (!existingHint) {
          const hint = document.createElement('details');
          hint.className = 'field-help';
          hint.dataset.help = 'single-mode';
          hint.innerHTML = `<summary aria-label="${escapeHtml(t("rules.singleModeHint"))}">?</summary><div class="field-help-popover">${escapeHtml(t("rules.singleModeHint"))}</div>`;
          addConditionBtn.insertAdjacentElement('afterend', hint);
        }
      } else {
        addConditionBtn.disabled = false;
        if (existingHint) {
          existingHint.remove();
        }
      }
    }
    return;
  }

  // Handle inline action type change
  if (event.target.classList.contains("action-type-selector")) {
    const actionRow = event.target.closest("[data-inline-action]");
    if (actionRow) {
      const index = parseInt(actionRow.dataset.index, 10);
      const scope = actionRow.dataset.scope || "actions";
      const newType = event.target.value;
      const animations = state.config?.animations || { default: { id: "idle", asset: "" }, clips: [] };

      // Rebuild the action row with new type
      const newAction = { type: newType };
      if (newType === "playAnimation") {
        newAction.animation = animations.default.id;
        newAction.durationMs = 900;
      } else if (newType === "setKeyframeProgress") {
        const keyframeClip = (animations.clips || []).find((clip) => clip.type === "keyframe");
        newAction.animation = (keyframeClip || animations.default).id;
        newAction.progressFrom = "angleToPetProgress";
      } else if (newType === "showMessage") {
        newAction.text = "";
        newAction.durationMs = 1800;
      } else if (newType === "randomMessage") {
        newAction.messages = [];
        newAction.durationMs = 1800;
      } else if (newType === "changeScale") {
        newAction.scale = 1;
      } else if (newType === "changeOpacity") {
        newAction.opacity = 1;
      }

      const newHTML = renderSingleInlineAction(newAction, index, animations, scope);
      actionRow.outerHTML = newHTML;
    }
    return;
  }

  // Handle animation selector change in playAnimation action
  if (event.target.dataset.role === "animation-selector") {
    const actionRow = event.target.closest("[data-inline-action]");
    if (actionRow) {
      const selectedOption = event.target.options[event.target.selectedIndex];
      const animType = selectedOption.dataset.type;
      const animDuration = selectedOption.dataset.duration || 900;

      const durationHint = actionRow.querySelector('[data-role="oneshot-duration-hint"]');
      const loopHint = actionRow.querySelector('[data-role="loop-hint"]');

      if (animType === "oneshot") {
        // Show duration hint for oneshot
        if (loopHint) loopHint.style.display = "none";
        if (durationHint) {
          durationHint.style.display = "";
          const input = durationHint.querySelector('input[name="durationMs"]');
          if (input) input.value = animDuration;
        }
      } else {
        // Show loop hint for loop/default animations
        if (durationHint) durationHint.style.display = "none";
        if (loopHint) loopHint.style.display = "";
      }
    }
    return;
  }

  if (event.target.dataset.role !== "condition-type") return;

  const row = event.target.closest("[data-rule-condition]");
  const fieldSelect = row && row.querySelector('[data-role="filter-field"]');
  if (!fieldSelect) return;

  const scope = row.dataset.scope || "conditions";
  const fields = getFieldsForCondition(event.target.value);
  fieldSelect.innerHTML = [`<option value="">${t("rules.noFilter")}</option>`, ...fields.map((field) => {
    return `<option value="${escapeHtml(field)}">${escapeHtml(getFieldLabel(field))}</option>`;
  })].join("");

  const sustainField = row.querySelector('[data-role="condition-sustain"]');
  if (sustainField) {
    const showSustain = event.target.value === "mouseMove";
    sustainField.style.display = showSustain ? "" : "none";
    const sustainInput = sustainField.querySelector('[name="conditionSustainMs"]');
    if (!showSustain && sustainInput) sustainInput.value = "";
  }

  const form = event.target.closest("form");
  if (form && scope === "conditions") {
    const hasMouseMoveCondition = Array.from(form.querySelectorAll('[data-rule-condition][data-scope="conditions"] [name="conditionType"]'))
      .some((select) => select.value === "mouseMove");
    form.querySelectorAll('[data-role="exit-state-block"]').forEach((block) => {
      block.style.display = hasMouseMoveCondition ? "" : "none";
    });
  }
}

/**
 * Handle click actions
 * @param {Event} event - Click event
 * @param {object} state - Panel state
 * @param {object} api - API object
 * @param {Function} saveConfig - Save config function
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function handleClickAction(event, state, api, saveConfig, render, refreshPackagesAndAssets, refreshLogs) {
  const button = event.target.closest("[data-action]");
  if (!button || state.savingKey) return;

  const action = button.dataset.action;

  if (action === "add-animation") {
    state.selectedClipId = "";
    state.animationDraft = null;
    render();
  }
  if (action === "select-animation") {
    state.selectedClipId = button.dataset.clipId;
    state.animationDraft = null;
    render();
  }
  if (action === "delete-animation") {
    const animations = state.config?.animations || { default: { id: "idle", asset: "" }, clips: [] };
    if (state.selectedClipId && state.selectedClipId !== animations.default.id) {
      await deleteAnimation(state.selectedClipId, state.config, saveConfig, state, render);
    }
  }
  if (action === "new-rule") {
    state.selectedRuleId = "";
    state.ruleEditorOpen = true;
    render();
    return;
  }
  if (action === "edit-rule") {
    state.selectedRuleId = button.dataset.id;
    state.ruleEditorOpen = true;
    render();
    return;
  }
  if (action === "close-rule-editor") {
    state.ruleEditorOpen = false;
    state.selectedRuleId = "";
    render();
    return;
  }
  if (action === "delete-rule") {
    await saveConfig(deleteConfigRule(state.config, button.dataset.id), "rule");
    if (state.selectedRuleId === button.dataset.id) {
      state.selectedRuleId = "";
      state.ruleEditorOpen = false;
      render();
    }
    return;
  }
  if (action === "toggle-rule-enabled") {
    const rules = Array.isArray(state.config?.triggerRules) ? state.config.triggerRules : [];
    const rule = rules.find((item) => item && item.id === button.dataset.id);
    if (!rule) return;

    await saveConfig(updateConfigRule(state.config, {
      ...rule,
      enabled: button.checked
    }), "rule");
    return;
  }
  if (action === "show-condition-help") {
    state.conditionHelpOpen = true;
    render();
    return;
  }
  if (action === "close-condition-help") {
    state.conditionHelpOpen = false;
    render();
    return;
  }
  if (action === "toggle-condition-filter") {
    const card = button.closest("[data-rule-condition]");
    const filterPanel = card && card.querySelector(".condition-card-filter");
    const icon = button.querySelector(".filter-icon");
    if (filterPanel && icon) {
      const isHidden = filterPanel.style.display === "none";
      filterPanel.style.display = isHidden ? "" : "none";
      icon.textContent = isHidden ? "▼" : "▶";
      button.setAttribute("aria-expanded", isHidden ? "true" : "false");
    }
    return;
  }
  if (action === "select-condition") {
    state.selectedConditionType = button.dataset.condition;
    render();
  }
  if (action === "add-rule-condition") {
    const form = button.closest("form");
    const scope = button.dataset.scope || "conditions";
    const list = form.querySelector(`.conditions-list[data-scope="${scope}"]`);
    const index = list.querySelectorAll(`[data-rule-condition][data-scope="${scope}"]`).length;
    list.insertAdjacentHTML("beforeend", renderRuleConditionEditor({ type: scope === "exitConditions" ? "mouseMove" : "click", filters: [] }, index, scope));
    const relation = form.querySelector(`[data-role="condition-relation"][data-scope="${scope}"]`)?.value || "single";
    if (relation === "single" && index + 1 >= 1) button.disabled = true;
  }
  if (action === "remove-rule-condition") {
    const row = button.closest("[data-rule-condition]");
    if (row && row.parentElement.querySelectorAll(`[data-rule-condition][data-scope="${row.dataset.scope || "conditions"}"]`).length > 1) {
      const form = button.closest("form");
      const scope = row.dataset.scope || "conditions";
      row.remove();
      const addConditionBtn = form.querySelector(`[data-action="add-rule-condition"][data-scope="${scope}"]`);
      const relation = form.querySelector(`[data-role="condition-relation"][data-scope="${scope}"]`)?.value || "single";
      const conditionCount = form.querySelectorAll(`[data-rule-condition][data-scope="${scope}"]`).length;
      if (addConditionBtn) addConditionBtn.disabled = relation === "single" && conditionCount >= 1;
      if (scope === "conditions") {
        const hasMouseMoveCondition = Array.from(form.querySelectorAll('[data-rule-condition][data-scope="conditions"] [name="conditionType"]'))
          .some((select) => select.value === "mouseMove");
        form.querySelectorAll('[data-role="exit-state-block"]').forEach((block) => {
          block.style.display = hasMouseMoveCondition ? "" : "none";
        });
      }
    }
  }
  if (action === "add-inline-action") {
    const scope = button.dataset.scope || "actions";
    const container = button.closest(".inline-actions").querySelector(`.inline-actions-list[data-scope="${scope}"]`);
    const index = container.querySelectorAll(`[data-inline-action][data-scope="${scope}"]`).length;
    const animations = state.config?.animations || { default: { id: "idle", asset: "" }, clips: [] };
    container.insertAdjacentHTML("beforeend", renderSingleInlineAction({
      type: "playAnimation",
      animation: animations.default.id,
      durationMs: 900
    }, index, animations, scope));
  }
  if (action === "remove-inline-action") {
    const row = button.closest("[data-inline-action]");
    if (row) {
      const scope = row.dataset.scope || "actions";
      row.remove();
      // Re-number remaining actions in the same scope
      const container = row.parentElement;
      container.querySelectorAll(`[data-inline-action][data-scope="${scope}"]`).forEach((actionRow, index) => {
        actionRow.dataset.index = index;
        const numberSpan = actionRow.querySelector(".action-number");
        if (numberSpan) numberSpan.textContent = `${index + 1}.`;
      });
    }
  }
  if (action === "pick-asset") {
    await pickAsset(api, state, render);
  }
  if (action === "delete-asset") {
    await deleteReferencedAsset(button.dataset.asset, api, state, render);
    if (refreshPackagesAndAssets) {
      await refreshPackagesAndAssets();
      render();
    }
  }
  if (action === "select-package-asset") {
    state.selectedPackageAsset = button.dataset.asset;
    render();
  }
  if (action === "open-keyframe-editor") {
    const clipId = button.dataset.clipId;
    const form = button.closest(".asset-detail")?.querySelector("#animation-form");
    const selectedClipId = getSelectedClipId(state);
    const hasDraft = state.animationDraft && state.animationDraft.selectedClipId === selectedClipId;
    const draft = hasDraft || !clipId ? updateAnimationDraftFromForm(form, state) : null;
    const animations = state.config?.animations || { default: { id: "idle", asset: "" }, clips: [] };
    const clip = (animations.clips || []).find((c) => c.id === clipId) || {};
    const packageAssets = Array.isArray(state.packageAssets) ? state.packageAssets : [];
    const draftClip = draft?.clip || null;
    const assetPath = draftClip?.asset || clip.asset || "";
    const assetEntry = packageAssets.find((a) => a.asset === assetPath) || {};
    state.keyframeEditorClipId = clipId || "__animation-draft__";
    state.keyframeEditorIsDraft = Boolean(draft);
    state.keyframeEditorKeyframes = normalizeKeyframes(draftClip?.keyframes || clip.keyframes || DEFAULT_KEYFRAMES);
    state.keyframeEditorSelectedIndex = null;
    state.keyframeEditorAssetUrl = assetEntry.url || "";
    state.keyframeEditorAssetPath = assetPath;
    state.keyframeEditorOpen = true;
    render();
    // Scrub to first keyframe after video metadata loads
    setTimeout(() => {
      const video = document.querySelector("#keyframe-preview-video");
      if (video) {
        const scrub = () => {
          const kfs = normalizeKeyframes(state.keyframeEditorKeyframes);
          if (kfs.length > 0 && Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration * kfs[0].output;
          }
        };
        if (video.readyState >= 1) scrub();
        else video.onloadedmetadata = scrub;
      }
    }, 50);
    return;
  }
  if (action === "close-keyframe-editor") {
    if (state.keyframeEditorIsDraft && state.animationDraft) {
      state.animationDraft = {
        ...state.animationDraft,
        clip: {
          ...state.animationDraft.clip,
          keyframes: normalizeKeyframes(state.keyframeEditorKeyframes)
        }
      };
    } else if (state.keyframeEditorClipId) {
      const nextConfig = updateConfigAnimationKeyframes(
        state.config,
        state.keyframeEditorClipId,
        state.keyframeEditorKeyframes
      );
      const savedConfig = await saveConfig(nextConfig, "animation");
      if (savedConfig) {
        state.config = savedConfig;
      }
    }
    state.keyframeEditorOpen = false;
    state.keyframeEditorClipId = "";
    state.keyframeEditorIsDraft = false;
    state.keyframeEditorKeyframes = [];
    state.keyframeEditorSelectedIndex = null;
    state.keyframeEditorAssetUrl = "";
    state.keyframeEditorAssetPath = "";
    render();
    return;
  }
  if (action === "reset-keyframes-default") {
    state.keyframeEditorKeyframes = DEFAULT_KEYFRAMES.map((item) => ({ ...item }));
    render();
    return;
  }
  if (action === "start-new-package") {
    state.isCreatingPackage = true;
    render();
  }
  if (action === "cancel-new-package") {
    state.isCreatingPackage = false;
    render();
  }
  if (action === "toggle-package-edit") {
    state.packageEditMode = !state.packageEditMode;
    render();
  }
  if (action === "create-package") {
    if (api.packages && api.packages.create) {
      const input = document.querySelector('[data-role="new-package-id"]');
      const packageId = input ? input.value : "";
      if (!packageId || !packageId.trim()) return;
      const nextConfig = await api.packages.create(packageId.trim());
      if (nextConfig && nextConfig.ok === false) {
        showBanner(nextConfig.error || "Package create failed.");
        return;
      }
      state.config = nextConfig;
      state.selectedAssetPackageId = state.config.currentPackageId;
      state.selectedPackageAsset = "";
      state.isCreatingPackage = false;
      if (refreshPackagesAndAssets) await refreshPackagesAndAssets();
      render();
    }
  }
  if (action === "delete-package") {
    if (api.packages && api.packages.delete) {
      const packageId = button.dataset.packageId;
      const confirmed = window.confirm(t("assets.package.deleteConfirm", { packageId }));
      if (!confirmed) return;

      state.savingKey = "package-delete";
      render();
      try {
        const result = await api.packages.delete(packageId);
        if (!result || !result.ok) {
          showBanner((result && result.error) || t("assets.package.deleteFailed"));
          return;
        }

        if (state.config?.currentPackageId === packageId && api.config && api.config.load) {
          state.config = await api.config.load();
        } else if (result.currentPackageId && state.config) {
          state.config = {
            ...state.config,
            currentPackageId: result.currentPackageId
          };
        }
        state.selectedAssetPackageId = state.config?.currentPackageId || "default-pet";
        state.selectedPackageAsset = "";
        showBanner(t("assets.package.deleteSuccess", { packageId }), "success");
      } catch (error) {
        showBanner(`${t("assets.package.deleteFailed")}: ${error.message || error}`);
      } finally {
        state.savingKey = "";
      }

      if (refreshPackagesAndAssets) await refreshPackagesAndAssets();
      render();
    }
  }
  if (action === "toggle-asset-edit") {
    state.assetEditMode = !state.assetEditMode;
    render();
  }
  if (action === "delete-package-asset") {
    const references = getAssetReferences(button.dataset.asset, state.config);
    if (references.length > 0) {
      const confirmed = window.confirm(t("assets.delete.referencedConfirm", {
        count: references.length,
        asset: button.dataset.asset
      }));
      if (!confirmed) return;
    }
    await deleteReferencedAsset(button.dataset.asset, api, state, render);
    if (refreshPackagesAndAssets) {
      await refreshPackagesAndAssets();
      render();
    }
  }
  if (action === "switch-package") {
    if (api.packages && api.packages.switch) {
      const nextConfig = await api.packages.switch(button.dataset.packageId);
      if (nextConfig && nextConfig.ok === false) {
        showBanner(nextConfig.error || "Package switch failed.");
        return;
      }
      state.config = nextConfig;
      state.selectedAssetPackageId = state.config.currentPackageId;
      if (refreshPackagesAndAssets) await refreshPackagesAndAssets();
      render();
    }
  }
  if (action === "export-package") {
    await exportCurrentPetpack(api, state, render, button.dataset.packageId || state.config.currentPackageId);
    if (refreshPackagesAndAssets) await refreshPackagesAndAssets();
  }
  if (action === "import-petpack") {
    await importPetpackFromPicker(api, state, render, refreshPackagesAndAssets);
  }
  if (action === "export-petpack") {
    await exportCurrentPetpack(api, state, render);
  }
  if (action === "reset-position") {
    await resetPosition(state.config, saveConfig, api);
  }
  if (action === "save-system") {
    const languageSelect = document.querySelector("#language-select");
    const loggingEnabled = document.querySelector("#logging-enabled");
    const loggingLevel = document.querySelector("#logging-level");

    const newLanguage = languageSelect ? languageSelect.value : (state.config?.system?.language || "en");
    const nextConfig = updateConfigSystem(state.config, {
      language: newLanguage,
      logging: {
        enabled: loggingEnabled ? loggingEnabled.checked : state.config?.system?.logging?.enabled !== false,
        level: loggingLevel ? loggingLevel.value : (state.config?.system?.logging?.level || "info")
      }
    });
    await saveConfig(nextConfig, "system");

    // Update locale and re-render
    setLocale(newLanguage);
    if (typeof refreshLogs === "function") await refreshLogs({ preserveSelection: true });
    render();
    showBanner(t("message.saved"), "success");
    return;
  }
  if (action === "refresh-logs") {
    if (typeof refreshLogs === "function") {
      await refreshLogs({ preserveSelection: true });
    }
    return;
  }
  if (action === "clear-logs") {
    if (!api.system?.logs?.clear) return;
    const confirmed = window.confirm(t("system.logs.clearConfirm"));
    if (!confirmed) return;

    state.savingKey = "logs";
    render();
    try {
      const result = await api.system.logs.clear();
      if (!result || result.ok === false) {
        showBanner(result?.error || t("system.logs.clearFailed"));
        return;
      }
      state.selectedLogFile = "";
      state.logContent = "";
      state.logTruncated = false;
      if (typeof refreshLogs === "function") await refreshLogs({ preserveSelection: false });
      showBanner(t("system.logs.cleared"), "success");
    } catch (error) {
      showBanner(`${t("system.logs.clearFailed")}: ${error.message || error}`);
    } finally {
      state.savingKey = "";
      render();
    }
    return;
  }
  if (action === "open-log-directory") {
    if (!api.system?.logs?.openDirectory) return;
    const result = await api.system.logs.openDirectory();
    if (result && result.ok === false) {
      showBanner(result.error || t("system.logs.openFailed"));
    }
    return;
  }
  if (action === "quit-app") {
    await api.app.quit();
  }
}
