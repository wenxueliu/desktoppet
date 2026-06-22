/**
 * Rule condition editor component
 */

import { escapeHtml, selected } from "../ui/utils.js";
import { t } from "../../../shared/i18n.js";
import { TRIGGER_PARAMETER_FIELDS, FIELD_INPUT_TYPES, SUPPORTED_OPERATORS, getFieldsForCondition } from "../panel-state.js";

/**
 * Get translated label for condition type
 * @param {string} type - Condition type
 * @returns {string} Translated label
 */
export function getConditionTypeLabel(type) {
  const key = `rules.conditionTypes.${type}`;
  const translated = t(key);
  return translated !== key ? translated : type;
}

/**
 * Get translated label for field
 * @param {string} field - Field name
 * @returns {string} Translated label
 */
export function getFieldLabel(field) {
  const key = `rules.fields.${field}`;
  const translated = t(key);
  return translated !== key ? translated : field;
}

/**
 * Normalize condition for editor
 * @param {*} condition - Condition (string or object)
 * @returns {object} Normalized condition
 */
export function normalizeConditionForEditor(condition) {
  if (typeof condition === "string") {
    return { type: condition, filters: [] };
  }
  if (!condition || typeof condition !== "object") {
    return { type: "click", filters: [] };
  }
  return {
    type: condition.type || "click",
    filters: Array.isArray(condition.filters) ? condition.filters : []
  };
}

/**
 * Render rule condition editor
 * @param {object} condition - Condition object
 * @param {number} index - Condition index
 * @returns {string} Condition editor HTML
 */
export function renderRuleConditionEditor(condition, index) {
  const normalizedCondition = normalizeConditionForEditor(condition);
  const firstFilter = normalizedCondition.filters[0] || {};
  const supportedFields = getFieldsForCondition(normalizedCondition.type);
  const filterField = supportedFields.includes(firstFilter.field) ? firstFilter.field : "";
  const filterOperator = firstFilter.operator || "=";
  const filterValue = Array.isArray(firstFilter.value) ? firstFilter.value.join(", ") : (firstFilter.value ?? "");
  const canRemove = index > 0;

  return `
    <div class="item-row rule-condition-row" data-rule-condition>
      <div class="grid-3">
        <div class="field">
          <label for="rule-condition-type-${index}">${t("rules.conditionType")}</label>
          <select id="rule-condition-type-${index}" name="conditionType" data-role="condition-type">
            ${Object.keys(TRIGGER_PARAMETER_FIELDS).map((type) => `<option value="${escapeHtml(type)}" ${selected(normalizedCondition.type, type)}>${escapeHtml(getConditionTypeLabel(type))}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="rule-filter-field-${index}">${t("rules.filterField")}</label>
          <select id="rule-filter-field-${index}" name="filterField" data-role="filter-field">
            <option value="" ${selected(filterField, "")}>${t("rules.noFilter")}</option>
            ${supportedFields.map((field) => `<option value="${escapeHtml(field)}" ${selected(filterField, field)}>${escapeHtml(getFieldLabel(field))} (${escapeHtml(FIELD_INPUT_TYPES[field] || "text")})</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="rule-filter-operator-${index}">${t("rules.operator")}</label>
          <select id="rule-filter-operator-${index}" name="filterOperator">
            ${SUPPORTED_OPERATORS.map((operator) => `<option value="${escapeHtml(operator)}" ${selected(filterOperator, operator)}>${escapeHtml(operator)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="rule-filter-value-${index}">${t("rules.filterValue")}</label>
          <input id="rule-filter-value-${index}" name="filterValue" type="text" value="${escapeHtml(filterValue)}">
          <small>${t("rules.filterValueHint")}</small>
        </div>
        <div class="field">
          <label for="rule-filter-unit-${index}">${t("rules.unit")}</label>
          <input id="rule-filter-unit-${index}" name="filterUnit" type="text" value="${escapeHtml(firstFilter.unit || "")}" placeholder="px, px/s, ms">
        </div>
        <div class="field align-end">
          <button type="button" data-action="remove-rule-condition" ${canRemove ? "" : "disabled"}>${t("rules.remove")}</button>
        </div>
      </div>
    </div>
  `;
}
