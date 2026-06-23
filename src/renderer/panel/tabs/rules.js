/**
 * Rules tab
 */

import { escapeHtml, selected, checked, disabled as disabledHelper } from "../ui/utils.js";
import { renderHeader } from "../ui/header.js";
import { t } from "../../../shared/i18n.js";
import { SUPPORTED_RELATIONS, createId } from "../panel-state.js";
import { renderRuleConditionEditor, normalizeConditionForEditor } from "../components/rule-condition-editor.js";
import { renderInlineActionEditor } from "../components/inline-action-editor.js";
import { renderConditionBrowser } from "../components/condition-browser.js";

/**
 * Get rules from config
 * @param {object} config - Configuration object
 * @returns {Array} Rules array
 */
function getRules(config) {
  return Array.isArray(config && config.triggerRules) ? config.triggerRules : [];
}

/**
 * Get animations from config
 * @param {object} config - Configuration object
 * @returns {object} Animations object
 */
function getAnimations(config) {
  return config?.animations || { default: { id: "idle", asset: "" }, clips: [] };
}

/**
 * Get rule conditions for editor
 * @param {object} rule - Rule object
 * @returns {Array} Conditions array
 */
function getRuleConditionsForEditor(rule) {
  if (rule && Array.isArray(rule.conditions) && rule.conditions.length > 0) {
    return rule.conditions.map(normalizeConditionForEditor);
  }
  if (rule && rule.trigger) {
    return [{ type: rule.trigger, filters: Array.isArray(rule.filters) ? rule.filters : [] }];
  }
  return [{ type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }];
}

/**
 * Render rule row component
 * @param {object} rule - Rule object
 * @returns {string} Rule row HTML
 */
function renderRuleRow(rule) {
  const conditionSummary = Array.isArray(rule.conditions)
    ? rule.conditions.map((condition) => typeof condition === "string" ? condition : condition.type).join(", ")
    : "";
  const isEnabled = rule.enabled !== false;

  return `
    <div class="item-row rule-row">
      <label class="rule-enable-checkbox" title="${t("rules.form.enabled")}">
        <input type="checkbox" data-action="toggle-rule-enabled" data-id="${escapeHtml(rule.id)}" ${checked(isEnabled)} aria-label="${t("rules.form.enabled")}">
      </label>
      <div class="rule-row-main">
        <strong>${escapeHtml(rule.name || "Untitled rule")}</strong>
        <code>${escapeHtml(rule.id)}</code>
        <div class="rule-row-meta">
          <span>${escapeHtml(rule.relation || "single")}</span>
          <span>${escapeHtml(conditionSummary || "-")}</span>
          <span>${t("rules.form.priority")} ${escapeHtml(rule.priority ?? 0)}</span>
        </div>
      </div>
      <div class="rule-row-actions">
        <button type="button" data-action="edit-rule" data-id="${escapeHtml(rule.id)}">${t("rules.edit")}</button>
        <button class="button-danger" type="button" data-action="delete-rule" data-id="${escapeHtml(rule.id)}">${t("common.delete")}</button>
      </div>
    </div>
  `;
}

/**
 * Render rule editor form
 * @param {object} state - Panel state
 * @param {object} formRule - Rule form model
 * @param {object} animations - Animations object
 * @param {boolean} isEditing - Whether editing an existing rule
 * @returns {string} Rule editor HTML
 */
function renderRuleEditor(state, formRule, animations, isEditing) {
  const disabled = (key) => disabledHelper(key, state.savingKey);

  return `
    <div class="modal-backdrop">
      <section class="modal-panel rule-editor-modal" role="dialog" aria-modal="true" aria-labelledby="rule-editor-title">
        <div class="modal-header">
          <div>
            <h3 id="rule-editor-title">${isEditing ? t("rules.editRule") : t("rules.createRule")}</h3>
            <p>${t("rules.description")}</p>
          </div>
          <button class="button-icon" type="button" data-action="close-rule-editor" aria-label="${t("common.close")}">&times;</button>
        </div>
        <form id="rule-form" class="rule-editor-form">
          <input type="hidden" name="id" value="${escapeHtml(formRule.id)}">

          <div class="rule-editor-grid">
            <div class="rule-editor-main">
              <section class="editor-block">
                <div class="editor-block-header">
                  <h4>${t("rules.form.label")}</h4>
                </div>
                <div class="grid-3 compact-grid">
                  <div class="field wide-3">
                    <label for="rule-name">${t("rules.form.name")}</label>
                    <input id="rule-name" name="name" type="text" value="${escapeHtml(formRule.name)}" required>
                  </div>
                </div>
              </section>

              <section class="editor-block">
                <div class="editor-block-header">
                  <h4>${t("rules.form.conditions")}</h4>
                  <button type="button" data-action="add-rule-condition">${t("rules.form.addCondition")}</button>
                </div>
                <div id="rule-conditions" class="stack-list">
                  ${formRule.conditions.map((condition, index) => renderRuleConditionEditor(condition, index)).join("")}
                </div>
              </section>

              <section class="editor-block">
                <div class="editor-block-header">
                  <h4>${t("rules.inlineActions")}</h4>
                </div>
                ${renderInlineActionEditor(formRule.actions, animations)}
              </section>
            </div>

            <aside class="rule-editor-side">
              <div class="field">
                <label for="rule-relation">${t("rules.form.relation")}</label>
                <select id="rule-relation" name="relation">
                  ${SUPPORTED_RELATIONS.map((relation) => `<option value="${escapeHtml(relation)}" ${selected(formRule.relation, relation)}>${escapeHtml(relation)}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="rule-window">${t("rules.andWindowMs")}</label>
                <input id="rule-window" name="andWindowMs" type="number" min="0" step="100" value="${escapeHtml(formRule.andWindowMs)}">
              </div>
              <div class="field">
                <label for="rule-cooldown">${t("rules.form.cooldown")}</label>
                <input id="rule-cooldown" name="cooldownMs" type="number" min="0" step="100" value="${escapeHtml(formRule.cooldownMs)}">
              </div>
              <div class="field">
                <label for="rule-priority">${t("rules.form.priority")}</label>
                <input id="rule-priority" name="priority" type="number" step="1" value="${escapeHtml(formRule.priority)}">
              </div>
              <div class="field">
                <label for="rule-action-strategy">${t("rules.actionStrategy")}</label>
                <select id="rule-action-strategy" name="actionStrategy">
                  <option value="sequence" ${selected(formRule.actionStrategy, "sequence")}>${t("rules.sequence")}</option>
                  <option value="random" ${selected(formRule.actionStrategy, "random")}>${t("rules.random")}</option>
                </select>
              </div>
            </aside>
          </div>

          <div class="form-actions modal-actions">
            <button type="button" data-action="close-rule-editor">${t("common.cancel")}</button>
            <button class="button-primary" type="submit" ${disabled("rule")}>${state.savingKey === "rule" ? t("common.saving") : t("common.save")}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

/**
 * Render rules tab
 * @param {object} state - Panel state
 * @param {object} config - Configuration object
 * @returns {string} Rules HTML
 */
export function renderRules(state, config) {
  const rules = getRules(config);
  const animations = getAnimations(config);
  const selectedRule = rules.find((rule) => rule.id === state.selectedRuleId) || null;
  const formConditions = getRuleConditionsForEditor(selectedRule);
  const formRule = selectedRule ? {
    id: selectedRule.id,
    name: selectedRule.name,
    enabled: selectedRule.enabled !== false,
    relation: selectedRule.relation || "single",
    andWindowMs: selectedRule.andWindowMs ?? selectedRule.windowMs ?? "",
    cooldownMs: selectedRule.cooldownMs ?? 0,
    priority: selectedRule.priority ?? 0,
    conditions: formConditions,
    actionStrategy: selectedRule.actionStrategy || "sequence",
    actions: Array.isArray(selectedRule.actions) ? selectedRule.actions : []
  } : {
    id: createId("rule"),
    name: "",
    enabled: true,
    relation: "single",
    andWindowMs: 3000,
    cooldownMs: 0,
    priority: 0,
    conditions: formConditions,
    actionStrategy: "sequence",
    actions: []
  };
  const isEditorOpen = Boolean(state.ruleEditorOpen);

  return `
    ${renderHeader(t("rules.title"), t("rules.description"), `
      <button type="button" data-action="new-rule">${t("rules.addNew")}</button>
    `)}
    ${renderConditionBrowser(state.selectedConditionType)}
    <section class="panel-section">
      <div class="section-header"><h3>${t("rules.savedRules")}</h3><span class="muted">${rules.length} ${t("rules.saved")}</span></div>
      <div class="section-body">
        ${rules.length ? `<div class="item-list">${rules.map(renderRuleRow).join("")}</div>` : `<div class="empty-state">${t("rules.empty")}</div>`}
      </div>
    </section>
    ${isEditorOpen ? renderRuleEditor(state, formRule, animations, Boolean(selectedRule)) : ""}
  `;
}
