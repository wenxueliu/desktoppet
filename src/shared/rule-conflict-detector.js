import { normalizeCondition, normalizeRuleConditions } from "./rule-utils.js";

const REPEATED_ACTION_CONFLICT_TYPES = new Set([
  "playAnimation",
  "changeScale",
  "changeOpacity",
  "movePet"
]);

const ACTION_PAIR_CONFLICTS = [
  ["hidePet", "showPet"],
  ["disableInteractions", "enableInteractions"],
  ["setKeyframeProgress", "playAnimation"]
];

const RELATED_CONDITION_TYPE_GROUPS = [
  new Set(["mouseEnter", "hoverDuration"])
];


function getRuleName(rule) {
  return rule.name || rule.id || "Untitled rule";
}

function getRuleId(rule, index) {
  return rule.id || `rule-${index}`;
}

function normalizeComparableValue(value) {
  if (Array.isArray(value)) return value.map(normalizeComparableValue);
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
}

function filtersEqual(leftFilters, rightFilters) {
  if (leftFilters.length !== rightFilters.length) return false;

  const serialize = (filter) => JSON.stringify({
    field: filter.field,
    operator: filter.operator || "=",
    value: normalizeComparableValue(filter.value)
  });

  const left = leftFilters.map(serialize).sort();
  const right = rightFilters.map(serialize).sort();

  return left.every((item, index) => item === right[index]);
}

function getSingleFieldFilter(filters, field) {
  return filters.find((filter) => filter && filter.field === field) || null;
}

function getNumericRange(filter) {
  if (!filter) return null;

  const value = Number(filter.value);
  switch (filter.operator || "=") {
    case "=":
      return Number.isFinite(value) ? { min: value, max: value, minInclusive: true, maxInclusive: true } : null;
    case ">":
      return Number.isFinite(value) ? { min: value, max: Infinity, minInclusive: false, maxInclusive: false } : null;
    case ">=":
      return Number.isFinite(value) ? { min: value, max: Infinity, minInclusive: true, maxInclusive: false } : null;
    case "<":
      return Number.isFinite(value) ? { min: -Infinity, max: value, minInclusive: false, maxInclusive: false } : null;
    case "<=":
      return Number.isFinite(value) ? { min: -Infinity, max: value, minInclusive: false, maxInclusive: true } : null;
    case "between":
      if (!Array.isArray(filter.value) || filter.value.length < 2) return null;
      {
        const min = Number(filter.value[0]);
        const max = Number(filter.value[1]);
        return Number.isFinite(min) && Number.isFinite(max)
          ? { min, max, minInclusive: true, maxInclusive: true }
          : null;
      }
    default:
      return null;
  }
}

function rangeCovers(leftRange, rightRange) {
  if (!leftRange || !rightRange) return false;

  const coversMin = leftRange.min < rightRange.min
    || (leftRange.min === rightRange.min && (leftRange.minInclusive || !rightRange.minInclusive));
  const coversMax = leftRange.max > rightRange.max
    || (leftRange.max === rightRange.max && (leftRange.maxInclusive || !rightRange.maxInclusive));

  return coversMin && coversMax;
}

function filterCovers(leftFilter, rightFilter) {
  if (!leftFilter || !rightFilter || leftFilter.field !== rightFilter.field) return false;
  if (JSON.stringify(normalizeComparableValue(leftFilter.value)) === JSON.stringify(normalizeComparableValue(rightFilter.value))
    && (leftFilter.operator || "=") === (rightFilter.operator || "=")) {
    return true;
  }

  const leftRange = getNumericRange(leftFilter);
  const rightRange = getNumericRange(rightFilter);
  if (leftRange && rightRange) return rangeCovers(leftRange, rightRange);

  if ((leftFilter.operator || "=") === "in" && (rightFilter.operator || "=") === "=" && Array.isArray(leftFilter.value)) {
    return leftFilter.value.includes(rightFilter.value);
  }

  return false;
}

function filterSetCovers(leftFilters, rightFilters) {
  if (leftFilters.length === 0) return true;
  if (rightFilters.length === 0) return true;

  return leftFilters.every((leftFilter) => {
    const rightFilter = getSingleFieldFilter(rightFilters, leftFilter.field);
    return filterCovers(leftFilter, rightFilter);
  });
}

function conditionTypesMayOverlap(leftType, rightType) {
  if (leftType === rightType) return true;

  return RELATED_CONDITION_TYPE_GROUPS.some((group) => {
    return group.has(leftType) && group.has(rightType);
  });
}

function conditionsMayOverlap(leftCondition, rightCondition) {
  if (!leftCondition || !rightCondition || !conditionTypesMayOverlap(leftCondition.type, rightCondition.type)) return false;

  const leftFilters = leftCondition.filters || [];
  const rightFilters = rightCondition.filters || [];

  return filtersEqual(leftFilters, rightFilters)
    || filterSetCovers(leftFilters, rightFilters)
    || filterSetCovers(rightFilters, leftFilters);
}

function rulesMayOverlap(leftRule, rightRule) {
  const leftConditions = normalizeRuleConditions(leftRule);
  const rightConditions = normalizeRuleConditions(rightRule);

  return leftConditions.some((leftCondition) => {
    return rightConditions.some((rightCondition) => conditionsMayOverlap(leftCondition, rightCondition));
  });
}

function buildConflict(type, leftRule, rightRule, messageKey, params = {}) {
  const ruleIds = [leftRule.id, rightRule.id].sort();
  const ruleNames = [leftRule.name, rightRule.name];

  return {
    id: `${type}:${ruleIds.join(":")}:${params.actionType || ""}`,
    type,
    ruleIds,
    ruleNames,
    messageKey,
    params: {
      ruleA: leftRule.name,
      ruleB: rightRule.name,
      ruleList: ruleNames.join(", "),
      ...params
    }
  };
}

function getActionTypes(rule) {
  return Array.isArray(rule.actions)
    ? rule.actions.map((action) => action && action.type).filter(Boolean)
    : [];
}

function getActionConflicts(leftRule, rightRule) {
  const leftTypes = new Set(getActionTypes(leftRule));
  const rightTypes = new Set(getActionTypes(rightRule));
  const conflicts = [];

  for (const actionType of REPEATED_ACTION_CONFLICT_TYPES) {
    if (leftTypes.has(actionType) && rightTypes.has(actionType)) {
      conflicts.push(buildConflict(
        "actionConflict",
        leftRule,
        rightRule,
        "rules.conflicts.actionConflict",
        { actionType }
      ));
    }
  }

  for (const [pairLeft, pairRight] of ACTION_PAIR_CONFLICTS) {
    const hasBoth = (leftTypes.has(pairLeft) && rightTypes.has(pairRight))
      || (leftTypes.has(pairRight) && rightTypes.has(pairLeft));
    if (hasBoth) {
      conflicts.push(buildConflict(
        "actionConflict",
        leftRule,
        rightRule,
        "rules.conflicts.actionPairConflict",
        { actionType: `${pairLeft}/${pairRight}`, leftActionType: pairLeft, rightActionType: pairRight }
      ));
    }
  }

  return conflicts;
}

function hasSustainedMouseMove(rule) {
  const conditions = normalizeRuleConditions(rule);
  return conditions.some((condition) => {
    const sustainMs = Number(condition.sustainMs);
    return condition.type === "mouseMove" && Number.isFinite(sustainMs) && sustainMs > 0;
  });
}

function normalizeRule(rule, index) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule) || rule.enabled === false) return null;
  if (hasSustainedMouseMove(rule)) return null;

  return {
    ...rule,
    id: getRuleId(rule, index),
    name: getRuleName(rule)
  };
}

/**
 * Detect potential conflicts between enabled trigger rules.
 *
 * This is intentionally heuristic: it highlights rules that are likely to
 * overlap or overwrite each other without changing runtime behavior.
 *
 * @param {Array} rules - Trigger rules.
 * @returns {Array<{id: string, type: string, ruleIds: Array, ruleNames: Array, messageKey: string, params: object}>}
 */
export function detectRuleConflicts(rules = []) {
  const activeRules = Array.isArray(rules)
    ? rules.map(normalizeRule).filter(Boolean)
    : [];
  const conflicts = [];

  for (let leftIndex = 0; leftIndex < activeRules.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < activeRules.length; rightIndex += 1) {
      const leftRule = activeRules[leftIndex];
      const rightRule = activeRules[rightIndex];

      if (!rulesMayOverlap(leftRule, rightRule)) continue;

      const leftPriority = Number(leftRule.priority) || 0;
      const rightPriority = Number(rightRule.priority) || 0;

      if (leftPriority === rightPriority) {
        conflicts.push(buildConflict(
          "triggerOverlap",
          leftRule,
          rightRule,
          "rules.conflicts.triggerOverlap"
        ));
      } else {
        const highRule = leftPriority > rightPriority ? leftRule : rightRule;
        const lowRule = leftPriority > rightPriority ? rightRule : leftRule;

        if (highRule.stopOnMatch !== false) {
          conflicts.push(buildConflict(
            "priorityShadow",
            highRule,
            lowRule,
            "rules.conflicts.priorityShadow",
            { highRule: highRule.name, lowRule: lowRule.name }
          ));
        } else {
          conflicts.push(buildConflict(
            "triggerOverlap",
            leftRule,
            rightRule,
            "rules.conflicts.triggerOverlap"
          ));
        }
      }

      conflicts.push(...getActionConflicts(leftRule, rightRule));
    }
  }

  return conflicts;
}
