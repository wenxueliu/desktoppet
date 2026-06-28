/**
 * Rule condition editor component
 */

import { escapeHtml, selected, renderFieldHelp } from "../ui/utils.js";
import { t } from "../../../shared/i18n.js";
import { TRIGGER_PARAMETER_FIELDS, SUPPORTED_OPERATORS, getFieldsForCondition } from "../panel-state.js";

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
    filters: Array.isArray(condition.filters) ? condition.filters : [],
    sustainMs: condition.sustainMs
  };
}

/**
 * Render rule condition editor (compact card layout)
 * @param {object} condition - Condition object
 * @param {number} index - Condition index
 * @param {string} [scope="conditions"] - Condition list scope ("conditions" | "exitConditions")
 * @returns {string} Condition editor HTML
 */
export function renderRuleConditionEditor(condition, index, scope = "conditions") {
  const normalizedCondition = normalizeConditionForEditor(condition);
  const firstFilter = normalizedCondition.filters[0] || {};
  const supportedFields = getFieldsForCondition(normalizedCondition.type);
  const filterField = supportedFields.includes(firstFilter.field) ? firstFilter.field : "";
  const filterOperator = firstFilter.operator || "=";
  const filterValue = Array.isArray(firstFilter.value) ? firstFilter.value.join(", ") : (firstFilter.value ?? "");
  const sustainMs = normalizedCondition.type === "mouseMove" && normalizedCondition.sustainMs != null
    ? normalizedCondition.sustainMs
    : "";
  const canRemove = index > 0;
  const hasFilter = Boolean(filterField);
  const showSustain = normalizedCondition.type === "mouseMove";
  const idPrefix = `${scope}-${index}`;

  return `
    <div class="condition-card" data-rule-condition data-scope="${escapeHtml(scope)}">
      <div class="condition-card-header">
        <div class="condition-card-main">
          <label for="rule-condition-type-${escapeHtml(idPrefix)}" class="condition-label">${t("rules.conditionType")}</label>
          <select id="rule-condition-type-${escapeHtml(idPrefix)}" name="conditionType" data-role="condition-type" class="condition-type-select">
            ${Object.keys(TRIGGER_PARAMETER_FIELDS).map((type) => `<option value="${escapeHtml(type)}" ${selected(normalizedCondition.type, type)}>${escapeHtml(getConditionTypeLabel(type))}</option>`).join("")}
          </select>
        </div>
        <div class="condition-card-actions">
          <button type="button" class="button-icon" data-action="toggle-condition-filter" title="${t("rules.advancedFilter")}" aria-expanded="${hasFilter}">
            <span class="filter-icon">${hasFilter ? "▼" : "▶"}</span>
          </button>
          <button type="button" class="button-icon button-danger" data-action="remove-rule-condition" ${canRemove ? "" : "disabled"} title="${t("rules.remove")}">×</button>
        </div>
      </div>
      <div class="condition-card-filter" ${hasFilter ? "" : 'style="display: none;"'}>
        <div class="filter-grid">
          <div class="field">
            <label for="rule-filter-field-${escapeHtml(idPrefix)}">${t("rules.filterField")}</label>
            <select id="rule-filter-field-${escapeHtml(idPrefix)}" name="filterField" data-role="filter-field">
              <option value="" ${selected(filterField, "")}>${t("rules.noFilter")}</option>
              ${supportedFields.map((field) => `<option value="${escapeHtml(field)}" ${selected(filterField, field)}>${escapeHtml(getFieldLabel(field))}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="rule-filter-operator-${escapeHtml(idPrefix)}">${t("rules.operator")}</label>
            <select id="rule-filter-operator-${escapeHtml(idPrefix)}" name="filterOperator">
              ${SUPPORTED_OPERATORS.map((operator) => `<option value="${escapeHtml(operator)}" ${selected(filterOperator, operator)}>${escapeHtml(operator)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <div class="field-label-row">
              <label for="rule-filter-value-${escapeHtml(idPrefix)}">${t("rules.filterValue")}</label>
              ${renderFieldHelp(t("rules.filterValueHint"))}
            </div>
            <input id="rule-filter-value-${escapeHtml(idPrefix)}" name="filterValue" type="text" value="${escapeHtml(filterValue)}" placeholder="${t("rules.filterValuePlaceholder")}">
          </div>
        </div>
        <div class="field" data-role="condition-sustain" ${showSustain ? "" : 'style="display: none;"'}>
          <div class="field-label-row">
            <label for="rule-condition-sustain-${escapeHtml(idPrefix)}">${t("rules.conditionSustainMs")}</label>
            ${renderFieldHelp(t("rules.conditionSustainMsHint"))}
          </div>
          <input id="rule-condition-sustain-${escapeHtml(idPrefix)}" name="conditionSustainMs" type="number" min="0" step="100" value="${escapeHtml(sustainMs)}" placeholder="${t("rules.conditionSustainMsPlaceholder")}">
        </div>
      </div>
    </div>
  `;
}
