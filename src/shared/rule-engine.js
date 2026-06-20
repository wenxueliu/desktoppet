const DEFAULT_AND_WINDOW_MS = 3000;

function normalizeCondition(condition) {
  if (typeof condition === "string") {
    return { type: condition, filters: [] };
  }

  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return null;
  }

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
  if (!condition || event.type !== condition.type) return false;

  return condition.filters.every((filter) => {
    if (!filter || typeof filter !== "object") return false;
    return compareValues(event[filter.field], filter.operator, filter.value);
  });
}

function isCoolingDown(rule, now, lastTriggeredAtByRuleId) {
  if (!rule.cooldownMs) return false;

  const lastTriggeredAt = lastTriggeredAtByRuleId[rule.id];
  if (typeof lastTriggeredAt !== "number") return false;

  return now - lastTriggeredAt < rule.cooldownMs;
}

function matchesRule(rule, eventHistory, now) {
  const relation = rule.relation || "single";
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];

  if (conditions.length === 0) return false;

  if (relation === "single") {
    return eventHistory.some((event) => eventMatchesCondition(event, conditions[0]));
  }

  if (relation === "or") {
    return conditions.some((condition) => eventHistory.some((event) => eventMatchesCondition(event, condition)));
  }

  if (relation === "and") {
    const windowMs = typeof rule.windowMs === "number" ? rule.windowMs : DEFAULT_AND_WINDOW_MS;
    const cutoff = now - windowMs;
    const recentEvents = eventHistory.filter((event) => typeof event.timestamp === "number" && event.timestamp >= cutoff);

    return conditions.every((condition) => recentEvents.some((event) => eventMatchesCondition(event, condition)));
  }

  return false;
}

function evaluateRules({
  rules = [],
  eventHistory = [],
  now = Date.now(),
  lastTriggeredAtByRuleId = {}
} = {}) {
  return rules
    .filter((rule) => {
      if (!rule || typeof rule !== "object") return false;
      if (rule.enabled === false) return false;
      if (isCoolingDown(rule, now, lastTriggeredAtByRuleId)) return false;
      return matchesRule(rule, eventHistory, now);
    })
    .sort((left, right) => (right.priority || 0) - (left.priority || 0));
}

module.exports = {
  evaluateRules
};
