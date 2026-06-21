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
export const BASIC_STATE_TYPES = [
  { id: "idle", name: "Idle", description: "Default looping state." },
  { id: "click", name: "Click", description: "Played after the pet is clicked." },
  { id: "drag", name: "Drag", description: "Played while the pet is dragged." },
  { id: "hover", name: "Hover", description: "Played while the pointer stays over the pet." },
  { id: "random", name: "Random", description: "Available for random timer rules." },
  { id: "timed", name: "Timed", description: "Available for time-based rules." },
  { id: "sleep", name: "Sleep", description: "Low-presence or hidden rest state." }
];
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

function normalizeStateEntries(entries) {
  if (Array.isArray(entries)) {
    return entries.filter((entry) => entry && typeof entry === "object");
  }
  if (entries && typeof entries === "object") {
    return [entries];
  }
  return [];
}

export function getConfigStates(config) {
  const rawStates = config && config.states && typeof config.states === "object" && !Array.isArray(config.states)
    ? config.states
    : {};
  const normalizedStates = Object.fromEntries(
    Object.entries(rawStates).map(([stateType, entries]) => [stateType, normalizeStateEntries(entries)])
  );

  for (const stateType of BASIC_STATE_TYPES) {
    if (!Object.prototype.hasOwnProperty.call(normalizedStates, stateType.id)) {
      normalizedStates[stateType.id] = [];
    }
  }

  return normalizedStates;
}

export function buildStateFromForm(form) {
  const stateType = trimOptional(form.stateType) || "idle";
  return compactObject({
    id: trimOptional(form.id) || `${stateType}-default`,
    name: trimOptional(form.name),
    asset: trimOptional(form.asset),
    message: trimOptional(form.message),
    loop: Boolean(form.loop),
    weight: toOptionalNumber(form.weight),
    durationMs: toOptionalNumber(form.durationMs),
    returnToState: trimOptional(form.returnToState)
  });
}

export function updateConfigState(config, stateType, stateEntry) {
  const states = getConfigStates(config);
  const entries = normalizeStateEntries(states[stateType]);
  const entryIndex = entries.findIndex((item) => item && item.id === stateEntry.id);
  const nextEntries = entryIndex >= 0
    ? entries.map((item, index) => (index === entryIndex ? stateEntry : item))
    : [...entries, stateEntry];

  return {
    ...config,
    states: {
      ...states,
      [stateType]: nextEntries
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
  const states = getConfigStates(config);
  const actions = Array.isArray(config && config.customActions) ? config.customActions : [];

  return {
    ...config,
    states: Object.fromEntries(Object.entries(states).map(([stateType, entries]) => [
      stateType,
      normalizeStateEntries(entries).map((entry) => removeAssetFromEntry(entry, assetPath))
    ])),
    customActions: actions.map((action) => removeAssetFromEntry(action, assetPath))
  };
}

function collectAssetsFromEntries(assetSet, entries) {
  normalizeStateEntries(entries).forEach((entry) => {
    const asset = entry && (entry.asset || entry.assetPath);
    if (asset) assetSet.add(asset);
  });
}

export function getPanelOverviewStats(config) {
  const states = getConfigStates(config);
  const actions = Array.isArray(config && config.customActions) ? config.customActions : [];
  const rules = Array.isArray(config && config.triggerRules) ? config.triggerRules : [];
  const assets = new Set();

  Object.values(states).forEach((entries) => collectAssetsFromEntries(assets, entries));
  actions.forEach((action) => {
    const asset = action && (action.asset || action.assetPath);
    if (asset) assets.add(asset);
  });

  const display = {
    ...DEFAULT_DISPLAY,
    ...(config && config.display ? config.display : {})
  };

  return {
    packageId: (config && config.currentPackageId) || "None",
    stateCount: Object.values(states).filter((entries) => normalizeStateEntries(entries).length > 0).length,
    actionCount: actions.length,
    ruleCount: rules.length,
    assetCount: assets.size,
    displayScalePercent: Math.round(display.scale * 100),
    launchAtLogin: Boolean(config && config.system && config.system.launchAtLogin)
  };
}

export function buildActionFromForm(form) {
  return compactObject({
    id: trimOptional(form.id) || createId("action"),
    name: trimOptional(form.name) || "Untitled action",
    type: trimOptional(form.type) || "playAnimation",
    asset: trimOptional(form.asset),
    loop: Boolean(form.loop),
    returnToState: trimOptional(form.returnToState),
    message: trimOptional(form.message),
    durationMs: toOptionalNumber(form.durationMs),
    weight: toOptionalNumber(form.weight)
  });
}

export function updateConfigAction(config, action) {
  const actions = Array.isArray(config && config.customActions) ? config.customActions : [];
  const actionIndex = actions.findIndex((item) => item && item.id === action.id);
  const nextActions = actionIndex >= 0
    ? actions.map((item, index) => (index === actionIndex ? action : item))
    : [...actions, action];

  return {
    ...config,
    customActions: nextActions
  };
}

export function deleteConfigAction(config, actionId) {
  const actions = Array.isArray(config && config.customActions) ? config.customActions : [];
  const rules = Array.isArray(config && config.triggerRules) ? config.triggerRules : [];

  return {
    ...config,
    customActions: actions.filter((action) => action && action.id !== actionId),
    triggerRules: rules.map((rule) => ({
      ...rule,
      actions: Array.isArray(rule && rule.actions)
        ? rule.actions.filter((id) => id !== actionId)
        : []
    }))
  };
}

export function getFieldsForCondition(conditionType) {
  const fields = TRIGGER_PARAMETER_FIELDS[conditionType];
  return Array.isArray(fields) ? fields : [];
}

export function parseActionIds(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
  const actionIds = parseActionIds(form.actionIds);
  const existingActionIds = new Set(
    existingActions
      .map((action) => action && action.id)
      .filter(Boolean)
  );

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

  if (actionIds.length === 0) {
    errors.push(
      existingActionIds.size === 0
        ? "Create at least one custom action before saving a trigger rule."
        : "Select at least one action for this rule."
    );
  }

  for (const actionId of actionIds) {
    if (!existingActionIds.has(actionId)) {
      errors.push(`Unknown action ID: ${actionId}.`);
    }
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
    actions: parseActionIds(form.actionIds)
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
