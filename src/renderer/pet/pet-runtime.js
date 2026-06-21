const DEFAULT_AND_WINDOW_MS = 3000;

function normalizeCondition(condition) {
  if (typeof condition === "string") return { type: condition, filters: [] };
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) return null;
  return {
    type: condition.type,
    filters: Array.isArray(condition.filters) ? condition.filters : []
  };
}

function compareValues(actual, operator, expected) {
  switch (operator) {
    case "=":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return actual > expected;
    case ">=":
      return actual >= expected;
    case "<":
      return actual < expected;
    case "<=":
      return actual <= expected;
    case "between":
      return Array.isArray(expected) && expected.length >= 2 && actual >= expected[0] && actual <= expected[1];
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "notIn":
      return Array.isArray(expected) && !expected.includes(actual);
    default:
      return false;
  }
}

function eventMatchesCondition(event, rawCondition) {
  const condition = normalizeCondition(rawCondition);
  if (!condition || !event || event.type !== condition.type) return false;

  return condition.filters.every((filter) => {
    if (!filter || typeof filter !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(event, filter.field)) return false;
    return compareValues(event[filter.field], filter.operator, filter.value);
  });
}

function matchesOrderedConditions(conditions, recentEvents) {
  let eventIndex = 0;
  for (const condition of conditions) {
    let matched = false;
    while (eventIndex < recentEvents.length) {
      if (eventMatchesCondition(recentEvents[eventIndex], condition)) {
        matched = true;
        eventIndex += 1;
        break;
      }
      eventIndex += 1;
    }
    if (!matched) return false;
  }
  return true;
}

function ruleMatches(rule, eventHistory, now) {
  const currentEvent = eventHistory[eventHistory.length - 1];
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  const relation = rule.relation || "single";
  if (!currentEvent || conditions.length === 0) return false;

  if (relation === "single") return eventMatchesCondition(currentEvent, conditions[0]);
  if (relation === "or") return conditions.some((condition) => eventMatchesCondition(currentEvent, condition));
  if (relation !== "and") return false;

  const windowMs = typeof rule.windowMs === "number" ? rule.windowMs : DEFAULT_AND_WINDOW_MS;
  const anchor = typeof currentEvent.timestamp === "number" ? currentEvent.timestamp : now;
  const cutoff = anchor - windowMs;
  const recentEvents = eventHistory.filter((event) => typeof event.timestamp === "number" && event.timestamp >= cutoff);
  const finalCondition = conditions[conditions.length - 1];

  return eventMatchesCondition(currentEvent, finalCondition) && matchesOrderedConditions(conditions, recentEvents);
}

function evaluateRules({ rules, eventHistory, now, lastTriggeredAtByRuleId }) {
  return rules
    .filter((rule) => {
      if (!rule || typeof rule !== "object" || rule.enabled === false) return false;
      const lastTriggeredAt = lastTriggeredAtByRuleId[rule.id];
      if (rule.cooldownMs && typeof lastTriggeredAt === "number" && now - lastTriggeredAt < rule.cooldownMs) {
        return false;
      }
      return ruleMatches(rule, eventHistory, now);
    })
    .sort((left, right) => (right.priority || 0) - (left.priority || 0));
}

function selectActions(rule, actionsById) {
  const actionIds = Array.isArray(rule && rule.actions) ? rule.actions : [];
  const actions = actionIds.map((actionId) => actionsById[actionId]).filter(Boolean);

  if (rule && rule.actionStrategy === "random") {
    if (actions.length === 0) return [];
    return [actions[Math.floor(Math.random() * actions.length)]];
  }

  return actions;
}

function firstAssetUrlForState(states, assetsByPath, stateName) {
  const entries = Array.isArray(states && states[stateName]) ? states[stateName] : [];
  const entry = entries.find((candidate) => candidate && candidate.asset && assetsByPath[candidate.asset]);
  return entry ? assetsByPath[entry.asset] : "";
}

function withAssetUrl(action, assetsByPath) {
  if (!action || typeof action !== "object") return null;
  const asset = action.asset || action.assetPath;
  return {
    ...action,
    assetUrl: asset && assetsByPath[asset] ? assetsByPath[asset] : action.assetUrl
  };
}

function indexActions(actions, assetsByPath) {
  return actions.reduce((indexed, action) => {
    const nextAction = withAssetUrl(action, assetsByPath);
    if (nextAction && nextAction.id) {
      indexed[nextAction.id] = nextAction;
    }
    return indexed;
  }, {});
}

export function buildRuntimeModel({
  config = {},
  activePackage = null,
  defaultAssets
} = {}) {
  const manifest = activePackage && activePackage.manifest ? activePackage.manifest : null;
  const assetsByPath = activePackage && activePackage.assetsByPath ? activePackage.assetsByPath : {};
  const states = manifest && manifest.states ? manifest.states : {};
  const customActions = Array.isArray(config.customActions) ? config.customActions : [];
  const manifestActions = Array.isArray(manifest && manifest.actions) ? manifest.actions : [];
  const manifestRules = Array.isArray(manifest && manifest.triggers) ? manifest.triggers : [];
  const configRules = Array.isArray(config.triggerRules) ? config.triggerRules : [];

  return {
    config,
    activePackage,
    spriteAssets: {
      idle: firstAssetUrlForState(states, assetsByPath, "idle") || defaultAssets.idle,
      click: firstAssetUrlForState(states, assetsByPath, "click") || defaultAssets.click,
      drag: firstAssetUrlForState(states, assetsByPath, "drag") || defaultAssets.drag
    },
    actionsById: {
      ...indexActions(manifestActions, assetsByPath),
      ...indexActions(customActions, assetsByPath)
    },
    rules: [...manifestRules, ...configRules]
  };
}

export function createRuleRuntime({
  rules = [],
  actionsById = {},
  maxHistory = 40,
  now = Date.now
} = {}) {
  const eventHistory = [];
  const lastTriggeredAtByRuleId = {};

  return {
    evaluateEvent(event) {
      const timestamp = typeof event.timestamp === "number" ? event.timestamp : now();
      const nextEvent = { ...event, timestamp };
      eventHistory.push(nextEvent);
      if (eventHistory.length > maxHistory) {
        eventHistory.splice(0, eventHistory.length - maxHistory);
      }

      const matchedRules = evaluateRules({
        rules,
        eventHistory,
        now: timestamp,
        lastTriggeredAtByRuleId
      });
      const rule = matchedRules[0];
      if (!rule) return [];

      lastTriggeredAtByRuleId[rule.id] = timestamp;
      return selectActions(rule, actionsById);
    },

    getLastTriggeredAtByRuleId() {
      return { ...lastTriggeredAtByRuleId };
    }
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function getRandomMessage(action) {
  if (Array.isArray(action.messages) && action.messages.length > 0) {
    return action.messages[Math.floor(Math.random() * action.messages.length)];
  }
  return action.message || "";
}

export function executeRuntimeAction(action, effects) {
  if (!action || !effects) return false;

  const durationMs = Number.isFinite(action.durationMs) ? action.durationMs : undefined;

  switch (action.type) {
    case "playAnimation":
      effects.playState(action.state || action.id || "click", action.assetUrl);
      effects.scheduleIdle(durationMs || 900, action.returnToState);
      return true;
    case "switchState":
      effects.playState(action.state || action.returnToState || "idle", action.assetUrl);
      return true;
    case "showMessage":
      effects.showMessage(action.message || action.name || action.id || "", durationMs || 1800);
      return true;
    case "randomMessage":
      effects.showMessage(getRandomMessage(action), durationMs || 1800);
      return true;
    case "changeScale": {
      const scale = clampNumber(Number(action.scale ?? action.value), 0.25, 4);
      if (scale !== null) effects.applyDisplayPatch({ scale });
      return scale !== null;
    }
    case "changeOpacity": {
      const opacity = clampNumber(Number(action.opacity ?? action.value), 0, 1);
      if (opacity !== null) effects.applyDisplayPatch({ opacity });
      return opacity !== null;
    }
    case "hidePet":
      effects.setHidden(true);
      return true;
    case "showPet":
      effects.setHidden(false);
      return true;
    case "resetPosition":
      effects.resetPosition();
      return true;
    case "openPanel":
      effects.openPanel();
      return true;
    default:
      return false;
  }
}
