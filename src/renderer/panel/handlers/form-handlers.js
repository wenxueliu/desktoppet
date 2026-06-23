/**
 * Form submission handlers
 */

import {
  buildRuleFromForm,
  buildRuleConditionFromForm,
  updateConfigInteractions,
  updateConfigRule,
  updateConfigDisplay,
  validateRuleForm,
  DEFAULT_DISPLAY
} from "../panel-state.js";
import { showBanner } from "../ui/banner.js";
import { setFormSaving } from "../ui/utils.js";

function createUuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

/**
 * Read rule conditions from form
 * @param {HTMLFormElement} form - Form element
 * @returns {Array} Conditions array
 */
function readRuleConditionsFromForm(form) {
  return Array.from(form.querySelectorAll("[data-rule-condition]")).map((row) => {
    const conditionType = row.querySelector('[name="conditionType"]');
    const filterField = row.querySelector('[name="filterField"]');
    const filterOperator = row.querySelector('[name="filterOperator"]');
    const filterValue = row.querySelector('[name="filterValue"]');
    const filterUnit = row.querySelector('[name="filterUnit"]');
    const field = filterField ? filterField.value : "";

    return buildRuleConditionFromForm({
      type: conditionType ? conditionType.value : "click",
      field,
      operator: filterOperator ? filterOperator.value : "=",
      value: filterValue ? filterValue.value : "",
      unit: filterUnit ? filterUnit.value : ""
    });
  });
}

/**
 * Save display settings from form
 * @param {HTMLFormElement} form - Display form
 * @param {object} config - Current config
 * @param {Function} saveConfig - Save config function
 * @param {object} api - API object
 * @returns {Promise<void>}
 */
export async function saveDisplayFromForm(form, config, saveConfig, api) {
  const formData = new FormData(form);
  const nextDisplay = {
    scale: Number(formData.get("scale")) / 100,
    opacity: Number(formData.get("opacity")) / 100,
    alwaysOnTop: form.elements.alwaysOnTop.checked,
    mousePassthrough: form.elements.mousePassthrough.checked
  };
  const nextConfig = updateConfigDisplay(config, nextDisplay);
  const savedConfig = await saveConfig(nextConfig, "display");

  if (savedConfig) {
    await Promise.all([
      api.pet.applyDisplay(savedConfig.display || nextDisplay),
      api.pet.setAlwaysOnTop(nextDisplay.alwaysOnTop),
      api.pet.setMousePassthrough(nextDisplay.mousePassthrough)
    ]);
  }
}

/**
 * Reset pet position
 * @param {object} config - Current config
 * @param {Function} saveConfig - Save config function
 * @param {object} api - API object
 * @returns {Promise<void>}
 */
export async function resetPosition(config, saveConfig, api) {
  const nextConfig = updateConfigDisplay(config, {
    x: DEFAULT_DISPLAY.x,
    y: DEFAULT_DISPLAY.y
  });
  const savedConfig = await saveConfig(nextConfig, "display");
  if (savedConfig && api.pet && api.pet.resetPosition) {
    await api.pet.resetPosition({
      x: DEFAULT_DISPLAY.x,
      y: DEFAULT_DISPLAY.y
    });
  }
}

/**
 * Save animation from form
 * @param {HTMLFormElement} form - Animation form
 * @param {object} config - Current config
 * @param {Function} saveConfig - Save config function
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function saveAnimationFromForm(form, config, saveConfig, state, render) {
  const formData = new FormData(form);
  const submittedId = String(formData.get("id") || "").trim();
  const clipId = submittedId || createUuid();
  const name = String(formData.get("name") || "").trim();
  const asset = formData.get("asset");
  const type = formData.get("type") || "oneshot";
  const durationMs = formData.get("durationMs") ? Number(formData.get("durationMs")) : 900;
  const isDefault = formData.get("isDefault") === "true";

  if (!name || !asset) {
    showBanner("Animation name and asset are required.");
    return;
  }

  // Build animations config
  const animations = config?.animations || { default: { id: "idle", asset: "" }, clips: [] };

  if (isDefault) {
    // Update default animation
    animations.default = { id: clipId, name, asset };
  } else {
    // Update or add clip
    const existingIndex = animations.clips.findIndex(c => c.id === clipId);
    const clip = { id: clipId, name, asset, type };
    if (type === "oneshot" && durationMs) {
      clip.durationMs = durationMs;
    }

    if (existingIndex >= 0) {
      animations.clips[existingIndex] = clip;
    } else {
      animations.clips.push(clip);
    }
  }

  const nextConfig = { ...config, animations };
  const savedConfig = await saveConfig(nextConfig, "animation");

  if (savedConfig) {
    state.selectedClipId = clipId;
    render();
  }
}

/**
 * Delete animation from config
 * @param {string} clipId - Clip ID to delete
 * @param {object} config - Current config
 * @param {Function} saveConfig - Save config function
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function deleteAnimation(clipId, config, saveConfig, state, render) {
  const animations = config?.animations || { default: { id: "idle", asset: "" }, clips: [] };

  // Can't delete default animation
  if (clipId === animations.default.id) {
    showBanner("Cannot delete the default animation.");
    return;
  }

  animations.clips = animations.clips.filter(c => c.id !== clipId);
  const nextConfig = { ...config, animations };
  const savedConfig = await saveConfig(nextConfig, "animation");

  if (savedConfig) {
    state.selectedClipId = animations.default.id;
    render();
  }
}

/**
 * Save interaction from form
 * @param {HTMLFormElement} form - Interaction form
 * @param {object} config - Current config
 * @param {Function} saveConfig - Save config function
 * @returns {Promise<void>}
 */
export async function saveInteractionFromForm(form, config, saveConfig) {
  const nextInteractions = {
    bubble: {
      showCloseButton: form.elements.bubbleShowCloseButton.checked
    }
  };

  await saveConfig(updateConfigInteractions(config, nextInteractions), "interaction");
}

/**
 * Read inline actions from form
 * @param {HTMLFormElement} form - Form element
 * @returns {Array} Actions array
 */
function readInlineActionsFromForm(form) {
  return Array.from(form.querySelectorAll('[data-inline-action]')).map((row) => {
    const type = row.querySelector('[name="actionType"]')?.value || "playAnimation";
    const action = { type };

    if (type === 'playAnimation') {
      const animationInput = row.querySelector('[name="animation"]');
      const durationInput = row.querySelector('[name="durationMs"]');
      if (animationInput) action.animation = animationInput.value;
      if (durationInput && durationInput.value) action.durationMs = Number(durationInput.value);
    } else if (type === 'showMessage') {
      const textInput = row.querySelector('[name="text"]');
      const durationInput = row.querySelector('[name="durationMs"]');
      const widthInput = row.querySelector('[name="bubbleMaxWidth"]');
      if (textInput) action.text = textInput.value;
      if (durationInput && durationInput.value) action.durationMs = Number(durationInput.value);
      if (widthInput && widthInput.value) action.bubbleMaxWidth = Number(widthInput.value);
    } else if (type === 'randomMessage') {
      const messagesInput = row.querySelector('[name="messages"]');
      const durationInput = row.querySelector('[name="durationMs"]');
      const widthInput = row.querySelector('[name="bubbleMaxWidth"]');
      if (messagesInput) {
        action.messages = messagesInput.value.split('\n').map(line => line.trim()).filter(Boolean);
      }
      if (durationInput && durationInput.value) action.durationMs = Number(durationInput.value);
      if (widthInput && widthInput.value) action.bubbleMaxWidth = Number(widthInput.value);
    } else if (type === 'changeScale') {
      const scaleInput = row.querySelector('[name="scale"]');
      if (scaleInput) action.scale = Number(scaleInput.value);
    } else if (type === 'changeOpacity') {
      const opacityInput = row.querySelector('[name="opacity"]');
      if (opacityInput) action.opacity = Number(opacityInput.value);
    }
    // hidePet, showPet, resetPosition, openPanel have no parameters

    return action;
  });
}

/**
 * Save rule from form
 * @param {HTMLFormElement} form - Rule form
 * @param {object} config - Current config
 * @param {Function} saveConfig - Save config function
 * @param {object} state - Panel state
 * @param {Function} render - Render function
 * @returns {Promise<void>}
 */
export async function saveRuleFromForm(form, config, saveConfig, state, render) {
  const rules = Array.isArray(config?.triggerRules) ? config.triggerRules : [];
  const existingRule = rules.find((rule) => rule && rule.id === form.elements.id.value);
  const formValue = {
    id: form.elements.id.value,
    name: form.elements.name.value,
    enabled: existingRule ? existingRule.enabled !== false : true,
    relation: form.elements.relation.value,
    andWindowMs: form.elements.andWindowMs.value,
    cooldownMs: form.elements.cooldownMs.value,
    priority: form.elements.priority.value,
    conditions: readRuleConditionsFromForm(form),
    actionStrategy: form.elements.actionStrategy.value,
    actions: readInlineActionsFromForm(form)
  };
  const errors = validateRuleForm(formValue);

  if (errors.length > 0) {
    showBanner(errors.join(" "));
    return;
  }

  const rule = buildRuleFromForm(formValue);
  const savedConfig = await saveConfig(updateConfigRule(config, rule), "rule");

  if (savedConfig) {
    state.selectedRuleId = rule.id;
    state.ruleEditorOpen = false;
    render();
  }
}

/**
 * Handle form submission
 * @param {Event} event - Submit event
 * @param {object} state - Panel state
 * @param {object} config - Current config
 * @param {Function} saveConfig - Save config function
 * @param {Function} render - Render function
 * @param {object} api - API object
 * @param {Function} importAssetFromForm - Import asset function
 * @returns {Promise<void>}
 */
export async function handleFormSubmit(event, state, config, saveConfig, render, api, importAssetFromForm) {
  event.preventDefault();
  if (state.savingKey) return;

  const form = event.target;
  const formId = form.getAttribute("id");
  let savePromise = null;

  if (formId === "display-form") {
    savePromise = saveDisplayFromForm(form, config, saveConfig, api);
  }
  if (formId === "animation-form") {
    savePromise = saveAnimationFromForm(form, config, saveConfig, state, render);
  }
  if (formId === "interaction-form") {
    savePromise = saveInteractionFromForm(form, config, saveConfig);
  }
  if (formId === "rule-form") {
    savePromise = saveRuleFromForm(form, config, saveConfig, state, render);
  }
  if (formId === "asset-import-form") {
    savePromise = importAssetFromForm(form);
  }
  if (!savePromise) return;

  setFormSaving(form, true);

  try {
    await savePromise;
  } finally {
    if (document.contains(form)) setFormSaving(form, false);
  }
}
