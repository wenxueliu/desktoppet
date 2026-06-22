/**
 * Condition browser component
 */

import { escapeHtml } from "../ui/utils.js";
import { t } from "../../../shared/i18n.js";
import { TRIGGER_PARAMETER_FIELDS, FIELD_INPUT_TYPES } from "../panel-state.js";
import { getConditionTypeLabel, getFieldLabel } from "./rule-condition-editor.js";

/**
 * Render condition browser
 * @param {string} selectedConditionType - Currently selected condition type
 * @returns {string} Condition browser HTML
 */
export function renderConditionBrowser(selectedConditionType) {
  const fields = TRIGGER_PARAMETER_FIELDS[selectedConditionType] || [];

  return `
    <section class="panel-section">
      <div class="section-header"><h3>${t("rules.conditionBrowser")}</h3></div>
      <div class="section-body browser-grid">
        <div class="condition-list">
          ${Object.keys(TRIGGER_PARAMETER_FIELDS).map((type) => `
            <button class="condition-button" type="button" data-action="select-condition" data-condition="${escapeHtml(type)}" aria-selected="${selectedConditionType === type}">
              ${escapeHtml(getConditionTypeLabel(type))}
            </button>
          `).join("")}
        </div>
        <div>
          <table class="table">
            <thead><tr><th>${t("rules.browserField")}</th><th>${t("rules.browserExpectedInput")}</th></tr></thead>
            <tbody>
              ${fields.map((field) => `
                <tr>
                  <td><code>${escapeHtml(getFieldLabel(field))}</code></td>
                  <td>${escapeHtml(FIELD_INPUT_TYPES[field] || "text")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}
