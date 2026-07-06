const path = require("path");
const {
  SUPPORTED_ACTION_TYPES,
  SUPPORTED_ASSET_EXTENSIONS,
  SUPPORTED_OPERATORS,
  TRIGGER_PARAMETER_FIELDS
} = require("./schema");

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeRelativeAssetPath(asset) {
  if (typeof asset !== "string" || asset.length === 0) return false;
  if (asset.includes("\\")) return false;
  if (path.isAbsolute(asset)) return false;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(asset)) return false;

  const segments = asset.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function validateAssetReference(asset, availableFiles, errors) {
  if (!asset || typeof asset !== "string") return;

  if (!isSafeRelativeAssetPath(asset)) {
    errors.push(`asset path is unsafe: ${asset}`);
  }

  const extension = path.extname(asset).toLowerCase();
  if (!SUPPORTED_ASSET_EXTENSIONS.includes(extension)) {
    errors.push(`asset extension is not supported: ${asset}`);
  }

  if (availableFiles.size > 0 && !availableFiles.has(asset)) {
    errors.push(`asset not found: ${asset}`);
  }
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getAnimationIds(animations) {
  const ids = new Set();
  if (animations && animations.default && animations.default.id) {
    ids.add(animations.default.id);
  }
  if (Array.isArray(animations && animations.clips)) {
    animations.clips.forEach((clip) => {
      if (clip && clip.id) ids.add(clip.id);
    });
  }
  return ids;
}

function validateUnitNumber(value, label, errors) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    errors.push(`${label} must be a number between 0 and 1`);
  }
}

function validateGreenScreenConfig(greenScreen, label, errors) {
  if (greenScreen === undefined) return;
  if (!isPlainObject(greenScreen)) {
    errors.push(`${label}.greenScreen must be an object`);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(greenScreen, "enabled") && typeof greenScreen.enabled !== "boolean") {
    errors.push(`${label}.greenScreen.enabled must be a boolean`);
  }
  if (Object.prototype.hasOwnProperty.call(greenScreen, "color") && (
    typeof greenScreen.color !== "string" || !/^#[0-9a-f]{6}$/i.test(greenScreen.color)
  )) {
    errors.push(`${label}.greenScreen.color must be a #RRGGBB color`);
  }
  if (Object.prototype.hasOwnProperty.call(greenScreen, "tolerance")) {
    validateUnitNumber(greenScreen.tolerance, `${label}.greenScreen.tolerance`, errors);
  }
  if (Object.prototype.hasOwnProperty.call(greenScreen, "softness")) {
    validateUnitNumber(greenScreen.softness, `${label}.greenScreen.softness`, errors);
  }
}

function validateAnimationClip(clip, label, availableFiles, errors) {
  if (!isPlainObject(clip)) {
    errors.push(`${label} must be an object`);
    return;
  }
  if (!clip.id) {
    errors.push(`${label}.id is required`);
  } else if (!isUuid(clip.id)) {
    errors.push(`${label}.id must be a UUID`);
  }
  if (!clip.name) errors.push(`${label}.name is required`);
  if (!clip.asset) errors.push(`${label}.asset is required`);
  validateAssetReference(clip.asset, availableFiles, errors);
  if (clip.type && !["default", "oneshot", "loop", "keyframe"].includes(clip.type)) {
    errors.push(`${label}.type is not supported`);
  }
  validateGreenScreenConfig(clip.greenScreen, label, errors);
}

function validateCondition(condition, label, errors) {
  const normalized = typeof condition === "string" ? { type: condition } : condition;
  if (!isPlainObject(normalized)) {
    errors.push(`${label} must be a string or object`);
    return;
  }

  const fields = TRIGGER_PARAMETER_FIELDS[normalized.type];
  if (!fields) {
    errors.push(`${label}.type is not supported`);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "required") && typeof normalized.required !== "boolean") {
    errors.push(`${label}.required must be a boolean`);
  }

  const filters = Array.isArray(normalized.filters) ? normalized.filters : [];
  for (const [filterIndex, filter] of filters.entries()) {
    const filterLabel = `${label}.filters[${filterIndex}]`;
    if (!isPlainObject(filter)) {
      errors.push(`${filterLabel} must be an object`);
      continue;
    }
    if (!fields.includes(filter.field)) {
      errors.push(`${filterLabel}.field is not supported for ${normalized.type}`);
    }
    if (!SUPPORTED_OPERATORS.includes(filter.operator)) {
      errors.push(`${filterLabel}.operator is not supported`);
    }
  }
}

function validateAction(action, label, animationIds, errors) {
  if (!isPlainObject(action)) {
    errors.push(`${label} must be an object`);
    return;
  }
  if (!action.type) {
    errors.push(`${label}.type is required`);
  } else if (!SUPPORTED_ACTION_TYPES.includes(action.type)) {
    errors.push(`${label}.type is not supported`);
  }
  if (action.asset || action.assetPath || action.assetUrl) {
    errors.push(`${label} cannot reference assets directly`);
  }
  if (["playAnimation", "setKeyframeProgress"].includes(action.type) && action.animation && !animationIds.has(action.animation)) {
    errors.push(`${label}.animation references missing animation: ${action.animation}`);
  }
}

function validateManifest(manifest, availableFiles = new Set()) {
  const errors = [];

  if (!isPlainObject(manifest)) {
    return { ok: false, errors: ["manifest must be an object"] };
  }

  if (!manifest.schemaVersion) errors.push("schemaVersion is required");
  if (!manifest.packageId) errors.push("packageId is required");
  if (!manifest.name) errors.push("name is required");
  if (!manifest.version) errors.push("version is required");

  validateAssetReference(manifest.preview, availableFiles, errors);

  const animations = manifest.animations;
  if (!isPlainObject(animations)) {
    errors.push("animations is required");
  } else {
    validateAnimationClip(animations.default, "animations.default", availableFiles, errors);
    if (!Array.isArray(animations.clips)) {
      errors.push("animations.clips must be an array");
    } else {
      animations.clips.forEach((clip, index) => {
        validateAnimationClip(clip, `animations.clips[${index}]`, availableFiles, errors);
      });
    }
  }

  const animationIds = getAnimationIds(animations);
  const triggerRules = Array.isArray(manifest.triggerRules) ? manifest.triggerRules : [];
  for (const [ruleIndex, rule] of triggerRules.entries()) {
    const ruleLabel = `triggerRules[${ruleIndex}]`;
    if (!isPlainObject(rule)) {
      errors.push(`${ruleLabel} must be an object`);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(rule, "stopOnMatch") && typeof rule.stopOnMatch !== "boolean") {
      errors.push(`${ruleLabel}.stopOnMatch must be a boolean`);
    }
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    conditions.forEach((condition, conditionIndex) => {
      validateCondition(condition, `${ruleLabel}.conditions[${conditionIndex}]`, errors);
    });
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    actions.forEach((action, actionIndex) => {
      validateAction(action, `${ruleLabel}.actions[${actionIndex}]`, animationIds, errors);
    });
    const state = isPlainObject(rule.state) ? rule.state : null;
    const exitConditions = state && Array.isArray(state.exitConditions) ? state.exitConditions : [];
    exitConditions.forEach((condition, conditionIndex) => {
      validateCondition(condition, `${ruleLabel}.state.exitConditions[${conditionIndex}]`, errors);
    });
    const exitActions = state && Array.isArray(state.exitActions) ? state.exitActions : [];
    exitActions.forEach((action, actionIndex) => {
      validateAction(action, `${ruleLabel}.state.exitActions[${actionIndex}]`, animationIds, errors);
    });
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateManifest, validateCondition, validateAction, getAnimationIds };
