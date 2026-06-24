/**
 * Click and change event handlers
 */

import { escapeHtml } from "../ui/utils.js";
import { t } from "../../../shared/i18n.js";
import { setLocale } from "../../../shared/i18n.js";
import {
  FIELD_INPUT_TYPES,
  getFieldsForCondition,
  deleteConfigRule,
  updateConfigRule,
  updateConfigSystem
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
export function handleInput(event) {
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
    const durationGroup = form && form.querySelector('[data-role="animation-duration"]');
    if (durationGroup) {
      durationGroup.hidden = event.target.value === "loop";
    }
    return;
  }

  if (event.target.id === "launch-at-login") {
    await setLaunchAtLogin(event.target.checked, api, state, render);
    return;
  }

  // Handle rule relation selector - show/hide time window field
  if (event.target.dataset.role === "relation-selector") {
    const form = event.target.closest("form");
    const relation = event.target.value;
    const windowField = form && form.querySelector("#and-window-field");
    const addConditionBtn = form && form.querySelector('[data-action="add-rule-condition"]');
    const conditionsList = form && form.querySelector("#rule-conditions");

    // Show/hide time window field for AND mode
    if (windowField) {
      windowField.style.display = relation === "and" ? "" : "none";
    }

    // Single mode: disable add button if already has 1 condition
    if (addConditionBtn && conditionsList) {
      const conditionCount = conditionsList.querySelectorAll('[data-condition-card]').length;
      const existingHint = addConditionBtn.parentNode.querySelector('.info-hint');

      if (relation === "single" && conditionCount >= 1) {
        addConditionBtn.disabled = true;
        if (!existingHint) {
          const hint = document.createElement('small');
          hint.className = 'info-hint';
          hint.style.marginTop = '8px';
          hint.textContent = t("rules.singleModeHint");
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
      const newType = event.target.value;
      const animations = state.config?.animations || { default: { id: "idle", asset: "" }, clips: [] };

      // Rebuild the action row with new type
      const newAction = { type: newType };
      if (newType === "playAnimation") {
        newAction.animation = animations.default.id;
        newAction.durationMs = 900;
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

      const newHTML = renderSingleInlineAction(newAction, index, animations);
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

  const fields = getFieldsForCondition(event.target.value);
  fieldSelect.innerHTML = [`<option value="">${t("rules.noFilter")}</option>`, ...fields.map((field) => {
    const inputType = FIELD_INPUT_TYPES[field] || "text";
    return `<option value="${escapeHtml(field)}">${escapeHtml(getFieldLabel(field))}</option>`;
  })].join("");
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
export async function handleClickAction(event, state, api, saveConfig, render, refreshPackagesAndAssets) {
  const button = event.target.closest("[data-action]");
  if (!button || state.savingKey) return;

  const action = button.dataset.action;

  if (action === "add-animation") {
    state.selectedClipId = "";
    render();
  }
  if (action === "select-animation") {
    state.selectedClipId = button.dataset.clipId;
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
    const list = button.closest("form").querySelector("#rule-conditions");
    const index = list.querySelectorAll("[data-rule-condition]").length;
    list.insertAdjacentHTML("beforeend", renderRuleConditionEditor({ type: "click", filters: [] }, index));
  }
  if (action === "remove-rule-condition") {
    const row = button.closest("[data-rule-condition]");
    if (row && row.parentElement.querySelectorAll("[data-rule-condition]").length > 1) {
      row.remove();
    }
  }
  if (action === "add-inline-action") {
    const container = button.closest(".inline-actions").querySelector(".inline-actions-list");
    const index = container.querySelectorAll("[data-inline-action]").length;
    const animations = state.config?.animations || { default: { id: "idle", asset: "" }, clips: [] };
    container.insertAdjacentHTML("beforeend", renderSingleInlineAction({
      type: "playAnimation",
      animation: animations.default.id,
      durationMs: 900
    }, index, animations));
  }
  if (action === "remove-inline-action") {
    const row = button.closest("[data-inline-action]");
    if (row) {
      row.remove();
      // Re-number remaining actions
      const container = row.parentElement;
      container.querySelectorAll("[data-inline-action]").forEach((actionRow, index) => {
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

    if (languageSelect) {
      const newLanguage = languageSelect.value;
      const nextConfig = updateConfigSystem(state.config, { language: newLanguage });
      await saveConfig(nextConfig, "system");

      // Update locale and re-render
      setLocale(newLanguage);
      render();
      showBanner(t("message.saved"), "success");
    }
  }
  if (action === "quit-app") {
    await api.app.quit();
  }
}
