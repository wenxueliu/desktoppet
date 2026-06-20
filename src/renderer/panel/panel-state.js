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

export function validateRuleForm(form, existingActions = []) {
  const errors = [];
  const conditionType = trimOptional(form.conditionType) || "click";
  const filterField = trimOptional(form.filterField);
  const supportedFields = getFieldsForCondition(conditionType);
  const actionIds = parseActionIds(form.actionIds);
  const existingActionIds = new Set(
    existingActions
      .map((action) => action && action.id)
      .filter(Boolean)
  );

  if (filterField && !supportedFields.includes(filterField)) {
    errors.push(`Field ${filterField} is not supported by ${conditionType}.`);
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
  const filterField = trimOptional(form.filterField);
  const filterOperator = trimOptional(form.filterOperator) || "=";
  const filter = filterField
    ? compactObject({
      field: filterField,
      operator: filterOperator,
      value: parseFilterValue(form.filterValue, filterField, filterOperator),
      unit: trimOptional(form.filterUnit)
    })
    : null;
  const condition = compactObject({
    type: trimOptional(form.conditionType) || "click",
    filters: filter ? [filter] : []
  });

  return compactObject({
    id: trimOptional(form.id) || createId("rule"),
    name: trimOptional(form.name) || "Untitled rule",
    enabled: Boolean(form.enabled),
    relation: trimOptional(form.relation) || "single",
    windowMs: toOptionalNumber(form.windowMs),
    cooldownMs: toFiniteNumber(form.cooldownMs, 0),
    priority: toFiniteNumber(form.priority, 0),
    conditions: [condition],
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
