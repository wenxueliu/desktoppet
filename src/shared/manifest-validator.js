const path = require("path");
const {
  SUPPORTED_ACTION_TYPES,
  SUPPORTED_ASSET_EXTENSIONS,
  SUPPORTED_OPERATORS,
  SUPPORTED_RELATIONS,
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

function validateStateReference(action, index, field, availableStates, errors) {
  if (!action[field]) return;
  if (!availableStates.has(action[field])) {
    errors.push(`actions[${index}].${field} references missing state: ${action[field]}`);
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
  if (!manifest.states || !Array.isArray(manifest.states.idle) || manifest.states.idle.length === 0) {
    errors.push("states.idle is required");
  }

  validateAssetReference(manifest.preview, availableFiles, errors);

  const states = isPlainObject(manifest.states) ? manifest.states : {};
  const availableStates = new Set(Object.keys(states));
  for (const stateEntries of Object.values(states)) {
    if (!Array.isArray(stateEntries)) continue;
    for (const state of stateEntries) {
      if (!isPlainObject(state)) continue;
      if (state.id) availableStates.add(state.id);
      validateAssetReference(state.asset, availableFiles, errors);
    }
  }

  const actionIds = new Set();
  const actions = Array.isArray(manifest.actions) ? manifest.actions : [];
  for (const [index, action] of actions.entries()) {
    if (!isPlainObject(action)) {
      errors.push(`actions[${index}] must be an object`);
      continue;
    }

    if (!action.id) {
      errors.push(`actions[${index}].id is required`);
    } else {
      actionIds.add(action.id);
    }

    if (!action.type) {
      errors.push(`actions[${index}].type is required`);
    } else if (!SUPPORTED_ACTION_TYPES.includes(action.type)) {
      errors.push(`actions[${index}].type is not supported`);
    }

    validateAssetReference(action.asset, availableFiles, errors);
    validateStateReference(action, index, "returnToState", availableStates, errors);
    validateStateReference(action, index, "state", availableStates, errors);
  }

  const triggers = Array.isArray(manifest.triggers) ? manifest.triggers : [];
  for (const [ruleIndex, rule] of triggers.entries()) {
    if (!isPlainObject(rule)) {
      errors.push(`triggers[${ruleIndex}] must be an object`);
      continue;
    }

    if (!SUPPORTED_RELATIONS.includes(rule.relation)) {
      errors.push(`triggers[${ruleIndex}].relation is not supported`);
    }

    const ruleActions = Array.isArray(rule.actions) ? rule.actions : [];
    for (const actionId of ruleActions) {
      if (!actionIds.has(actionId)) {
        errors.push(`triggers[${ruleIndex}].actions references missing action: ${actionId}`);
      }
    }

    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    for (const [conditionIndex, rawCondition] of conditions.entries()) {
      const condition = typeof rawCondition === "string" ? { type: rawCondition } : rawCondition;
      if (!isPlainObject(condition)) {
        errors.push(`triggers[${ruleIndex}].conditions[${conditionIndex}] must be a string or object`);
        continue;
      }

      const fields = TRIGGER_PARAMETER_FIELDS[condition.type];
      if (!fields) {
        errors.push(`triggers[${ruleIndex}].conditions[${conditionIndex}].type is not supported`);
        continue;
      }

      const filters = Array.isArray(condition.filters) ? condition.filters : [];
      for (const [filterIndex, filter] of filters.entries()) {
        if (!isPlainObject(filter)) {
          errors.push(`triggers[${ruleIndex}].conditions[${conditionIndex}].filters[${filterIndex}] must be an object`);
          continue;
        }

        if (!fields.includes(filter.field)) {
          errors.push(`triggers[${ruleIndex}].conditions[${conditionIndex}].filters[${filterIndex}].field is not supported for ${condition.type}`);
        }

        if (!SUPPORTED_OPERATORS.includes(filter.operator)) {
          errors.push(`triggers[${ruleIndex}].conditions[${conditionIndex}].filters[${filterIndex}].operator is not supported`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateManifest };
