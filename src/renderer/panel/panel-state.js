const POINTER_FIELDS = [
  "timestamp",
  "eventSource",
  "petPosition",
  "mousePosition",
  "mouseLocalPosition",
  "isInsidePet",
  "distanceToPetCenter",
  "distanceToPetBounds",
  "screenPosition"
];

const DRAG_FIELDS = [
  ...POINTER_FIELDS,
  "dragStartPosition",
  "currentPosition",
  "dragDeltaX",
  "dragDeltaY",
  "dragDistance",
  "dragDurationMs"
];

const TIME_FIELDS = ["timestamp", "eventSource", "elapsedMs"];
const CLOCK_FIELDS = ["timestamp", "eventSource", "currentTime", "currentHour", "dayOfWeek"];

export const SUPPORTED_ACTION_TYPES = [
  "playAnimation",
  "switchState",
  "showMessage",
  "randomMessage",
  "changeScale",
  "changeOpacity",
  "hidePet",
  "showPet",
  "resetPosition",
  "openPanel"
];
export const SUPPORTED_OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "between", "in", "notIn"];
export const SUPPORTED_RELATIONS = ["single", "or", "and"];
export const TRIGGER_PARAMETER_FIELDS = {
  click: POINTER_FIELDS,
  doubleClick: POINTER_FIELDS,
  rightClick: POINTER_FIELDS,
  dragStart: DRAG_FIELDS,
  dragging: DRAG_FIELDS,
  dragEnd: DRAG_FIELDS,
  mouseEnter: POINTER_FIELDS,
  mouseLeave: POINTER_FIELDS,
  mouseMove: [
    ...POINTER_FIELDS,
    "deltaX",
    "deltaY",
    "speed",
    "direction",
    "isMovingTowardPet",
    "isMovingAwayFromPet"
  ],
  hoverDuration: [...TIME_FIELDS, "isInsidePet"],
  idleDuration: TIME_FIELDS,
  timer: CLOCK_FIELDS,
  randomTimer: CLOCK_FIELDS,
  appLaunch: ["timestamp", "eventSource"],
  packageLoaded: ["timestamp", "eventSource"]
};

export const FIELD_INPUT_TYPES = {
  timestamp: "number",
  eventSource: "text",
  petPosition: "object",
  mousePosition: "object",
  mouseLocalPosition: "object",
  isInsidePet: "boolean",
  distanceToPetCenter: "number",
  distanceToPetBounds: "number",
  screenPosition: "object",
  dragStartPosition: "object",
  currentPosition: "object",
  dragDeltaX: "number",
  dragDeltaY: "number",
  dragDistance: "number",
  dragDurationMs: "number",
  deltaX: "number",
  deltaY: "number",
  speed: "number",
  direction: "select",
  isMovingTowardPet: "boolean",
  isMovingAwayFromPet: "boolean",
  elapsedMs: "number",
  currentTime: "text",
  currentHour: "number",
  dayOfWeek: "select"
};

export const DEFAULT_DISPLAY = {
  x: 80,
  y: 160,
  scale: 1,
  opacity: 1,
  alwaysOnTop: true,
  mousePassthrough: false,
  locked: false,
  showHoverButtons: true
};

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseFilterValue(value, field, operator) {
  if (operator === "between") {
    return String(value)
      .split(",")
      .map((item) => Number(item.trim()))
      .filter(Number.isFinite);
  }

  if (operator === "in" || operator === "notIn") {
    return String(value)
      .split(",")
      .map((item) => parseSingleValue(item.trim(), field))
      .filter((item) => item !== "");
  }

  return parseSingleValue(value, field);
}

function parseSingleValue(value, field) {
  const inputType = FIELD_INPUT_TYPES[field] || "text";
  if (inputType === "boolean") return value === true || value === "true" || value === "on";
  if (inputType === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  return String(value || "").trim();
}

function trimOptional(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : undefined;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

export function updateConfigDisplay(config, displayPatch) {
  return {
    ...config,
    display: {
      ...(config && config.display ? config.display : {}),
      ...displayPatch
    }
  };
}

export function updateConfigSystem(config, systemPatch) {
  return {
    ...config,
    system: {
      ...(config && config.system ? config.system : {}),
      ...systemPatch
    }
  };
}

export function updateConfigInteractions(config, interactionsPatch) {
  const currentInteractions = config && config.interactions && typeof config.interactions === "object"
    ? config.interactions
    : {};
  const currentBubble = currentInteractions.bubble && typeof currentInteractions.bubble === "object"
    ? currentInteractions.bubble
    : {};
  const nextBubblePatch = interactionsPatch && interactionsPatch.bubble && typeof interactionsPatch.bubble === "object"
    ? interactionsPatch.bubble
    : {};

  return {
    ...config,
    interactions: {
      ...currentInteractions,
      ...interactionsPatch,
      bubble: {
        ...currentBubble,
        ...nextBubblePatch
      }
    }
  };
}

function removeAssetFromEntry(entry, assetPath) {
  if (!entry || typeof entry !== "object") return entry;
  const nextEntry = { ...entry };
  if (nextEntry.asset === assetPath) delete nextEntry.asset;
  if (nextEntry.assetPath === assetPath) delete nextEntry.assetPath;
  return nextEntry;
}

export function removeConfigAssetReferences(config, assetPath) {
  const animations = config?.animations || { default: { id: "idle", asset: "" }, clips: [] };

  // Remove asset from default animation
  const newDefault = removeAssetFromEntry(animations.default, assetPath);

  // Remove asset from clips
  const newClips = animations.clips.map(clip => removeAssetFromEntry(clip, assetPath));

  return {
    ...config,
    animations: {
      default: newDefault,
      clips: newClips
    }
  };
}

function collectAssetsFromAnimations(assetSet, animations) {
  // Collect from default animation
  if (animations.default?.asset) {
    assetSet.add(animations.default.asset);
  }

  // Collect from clips
  if (Array.isArray(animations.clips)) {
    animations.clips.forEach(clip => {
      if (clip?.asset) {
        assetSet.add(clip.asset);
      }
    });
  }
}

export function getPanelOverviewStats(config) {
  const animations = config?.animations || { default: { id: "idle", asset: "" }, clips: [] };
  const rules = Array.isArray(config?.triggerRules) ? config.triggerRules : [];
  const assets = new Set();

  collectAssetsFromAnimations(assets, animations);

  const display = {
    ...DEFAULT_DISPLAY,
    ...(config?.display || {})
  };

  return {
    packageId: config?.currentPackageId || "None",
    animationCount: 1 + (animations.clips?.length || 0), // default + clips
    ruleCount: rules.length,
    assetCount: assets.size,
    displayScalePercent: Math.round(display.scale * 100),
    launchAtLogin: Boolean(config?.system?.launchAtLogin)
  };
}

export function getFieldsForCondition(conditionType) {
  const fields = TRIGGER_PARAMETER_FIELDS[conditionType];
  return Array.isArray(fields) ? fields : [];
}

export function buildRuleConditionFromForm(form = {}) {
  const conditionType = trimOptional(form.type) || "click";
  const filterField = trimOptional(form.field);
  const filterOperator = trimOptional(form.operator) || "=";

  return compactObject({
    type: conditionType,
    filters: filterField
      ? [compactObject({
        field: filterField,
        operator: filterOperator,
        value: parseFilterValue(form.value, filterField, filterOperator),
        unit: trimOptional(form.unit)
      })]
      : []
  });
}

export function validateRuleForm(form, existingActions = []) {
  const errors = [];
  const conditions = Array.isArray(form.conditions) && form.conditions.length > 0
    ? form.conditions
    : [{
      type: form.conditionType,
      filters: trimOptional(form.filterField)
        ? [{ field: form.filterField }]
        : []
    }];
  const actions = Array.isArray(form.actions) ? form.actions : [];

  for (const condition of conditions) {
    const conditionType = trimOptional(condition && condition.type) || "click";
    const supportedFields = getFieldsForCondition(conditionType);
    const filters = Array.isArray(condition && condition.filters) ? condition.filters : [];

    for (const filter of filters) {
      const filterField = trimOptional(filter && filter.field);
      if (filterField && !supportedFields.includes(filterField)) {
        errors.push(`Field ${filterField} is not supported by ${conditionType}.`);
      }
    }
  }

  if (actions.length === 0) {
    errors.push("At least one action is required.");
  }

  return errors;
}

export function buildRuleFromForm(form) {
  const conditions = Array.isArray(form.conditions) && form.conditions.length > 0
    ? form.conditions.map((condition) => compactObject({
      type: trimOptional(condition.type) || "click",
      filters: (Array.isArray(condition.filters) ? condition.filters : [])
        .map((filter) => buildRuleConditionFromForm({
          type: condition.type,
          field: filter.field,
          operator: filter.operator,
          value: filter.value,
          unit: filter.unit
        }).filters[0])
        .filter(Boolean)
    }))
    : [(() => {
      return buildRuleConditionFromForm({
        type: form.conditionType,
        field: form.filterField,
        operator: form.filterOperator,
        value: form.filterValue,
        unit: form.filterUnit
      });
    })()];

  return compactObject({
    id: trimOptional(form.id) || createId("rule"),
    name: trimOptional(form.name) || "Untitled rule",
    enabled: Boolean(form.enabled),
    relation: trimOptional(form.relation) || "single",
    windowMs: toOptionalNumber(form.windowMs),
    andWindowMs: toOptionalNumber(form.andWindowMs),
    cooldownMs: toFiniteNumber(form.cooldownMs, 0),
    priority: toFiniteNumber(form.priority, 0),
    conditions,
    actionStrategy: trimOptional(form.actionStrategy) || "sequence",
    actions: Array.isArray(form.actions) ? form.actions : []
  });
}

export function updateConfigRule(config, rule) {
  const rules = Array.isArray(config && config.triggerRules) ? config.triggerRules : [];
  const ruleIndex = rules.findIndex((item) => item && item.id === rule.id);
  const nextRules = ruleIndex >= 0
    ? rules.map((item, index) => (index === ruleIndex ? rule : item))
    : [...rules, rule];

  return {
    ...config,
    triggerRules: nextRules
  };
}

export function deleteConfigRule(config, ruleId) {
  const rules = Array.isArray(config && config.triggerRules) ? config.triggerRules : [];

  return {
    ...config,
    triggerRules: rules.filter((rule) => rule && rule.id !== ruleId)
  };
}
