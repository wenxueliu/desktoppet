/**
 * Shared rule normalization utilities.
 *
 * Used by both the runtime rule engine and the static conflict detector
 * so the two stay in sync on how conditions are parsed.
 */

function normalizeCondition(condition) {
  if (typeof condition === "string") {
    return { type: condition, filters: [], sustainMs: undefined, required: true };
  }

  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return null;
  }

  return {
    type: condition.type,
    filters: Array.isArray(condition.filters) ? condition.filters.filter(Boolean) : [],
    sustainMs: condition.sustainMs,
    required: condition.required !== false
  };
}

function normalizeRuleConditions(rule) {
  if (Array.isArray(rule.conditions) && rule.conditions.length > 0) {
    return rule.conditions.map(normalizeCondition).filter(Boolean);
  }

  if (rule.trigger) {
    return [
      normalizeCondition({
        type: rule.trigger,
        filters: Array.isArray(rule.filters) ? rule.filters : []
      })
    ].filter(Boolean);
  }

  return [];
}

export { normalizeCondition, normalizeRuleConditions };
