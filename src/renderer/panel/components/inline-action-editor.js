/**
 * Inline action editor component
 */

import { escapeHtml, selected, renderFieldHelp } from "../ui/utils.js";
import { t } from "../../../shared/i18n.js";

const ACTION_TYPES = [
  "playAnimation",
  "showMessage",
  "randomMessage",
  "changeScale",
  "changeOpacity",
  "hidePet",
  "showPet",
  "resetPosition",
  "openPanel"
];

/**
 * Render action type selector
 * @param {string} selectedType - Selected action type
 * @returns {string} HTML for action type selector
 */
function renderActionTypeSelector(selectedType) {
  return `
    <select name="actionType" class="action-type-selector">
      ${ACTION_TYPES.map(type => `
        <option value="${escapeHtml(type)}" ${selected(selectedType, type)}>
          ${escapeHtml(t(`rules.actionTypes.${type}`))}
        </option>
      `).join("")}
    </select>
  `;
}

/**
 * Render action parameters based on type
 * @param {object} action - Action object
 * @param {object} animations - Animations config
 * @returns {string} HTML for action parameters
 */
function renderActionParams(action, animations) {
  const type = action.type || "playAnimation";

  if (type === "playAnimation") {
    const clips = animations?.clips || [];
    const defaultClip = animations?.default || { id: "", name: "" };
    const allClips = [defaultClip, ...clips];

    // Find selected animation to check its type
    const selectedAnimId = action.animation || defaultClip.id;
    const selectedAnim = allClips.find(clip => clip.id === selectedAnimId);
    const isOneshotAnim = selectedAnim && selectedAnim.type === "oneshot";
    const animDuration = selectedAnim && selectedAnim.durationMs ? selectedAnim.durationMs : 900;

    return `
      <div class="action-params">
        <div class="field">
          <label>${t("rules.actionParams.animation")}</label>
          <select name="animation" required data-role="animation-selector">
            ${allClips.map(clip => `
              <option value="${escapeHtml(clip.id)}" ${selected(action.animation, clip.id)} data-type="${escapeHtml(clip.type || 'default')}" data-duration="${escapeHtml(clip.durationMs || 900)}">
                ${escapeHtml(clip.name || clip.id)}${clip.type ? ` (${clip.type})` : ""}
              </option>
            `).join("")}
          </select>
        </div>
        ${isOneshotAnim ? `
          <div class="field" data-role="oneshot-duration-hint">
            <div class="field-label-row">
              <label>${t("rules.actionParams.durationMs")}</label>
              ${renderFieldHelp(t("rules.actionParams.durationHint"))}
            </div>
            <input type="number" name="durationMs" value="${animDuration}" disabled>
          </div>
        ` : `
          <div class="field" data-role="loop-hint">
            <small class="info-hint">${t("rules.actionParams.loopHint")}</small>
          </div>
        `}
      </div>
    `;
  }

  if (type === "showMessage") {
    return `
      <div class="action-params">
        <div class="field field-full">
          <label>${t("rules.actionParams.text")}</label>
          <input type="text" name="text" value="${escapeHtml(action.text || "")}" required>
        </div>
        <div class="field">
          <div class="field-label-row">
            <label>${t("rules.actionParams.durationMs")}</label>
            ${renderFieldHelp(t("rules.actionParams.messageDurationHelp"))}
          </div>
          <input type="number" name="durationMs" value="${action.durationMs || 1800}" min="100" step="100">
        </div>
        <div class="field">
          <div class="field-label-row">
            <label>${t("rules.actionParams.bubbleMaxWidth")}</label>
            ${renderFieldHelp(t("rules.actionParams.bubbleMaxWidthHelp"))}
          </div>
          <input type="number" name="bubbleMaxWidth" value="${action.bubbleMaxWidth || 220}" min="120" max="480" step="10">
        </div>
      </div>
    `;
  }

  if (type === "randomMessage") {
    const messages = Array.isArray(action.messages) ? action.messages.join("\n") : "";
    return `
      <div class="action-params">
        <div class="field field-full">
          <label>${t("rules.actionParams.messages")}</label>
          <textarea name="messages" rows="3" required>${escapeHtml(messages)}</textarea>
        </div>
        <div class="field">
          <div class="field-label-row">
            <label>${t("rules.actionParams.durationMs")}</label>
            ${renderFieldHelp(t("rules.actionParams.messageDurationHelp"))}
          </div>
          <input type="number" name="durationMs" value="${action.durationMs || 1800}" min="100" step="100">
        </div>
        <div class="field">
          <div class="field-label-row">
            <label>${t("rules.actionParams.bubbleMaxWidth")}</label>
            ${renderFieldHelp(t("rules.actionParams.bubbleMaxWidthHelp"))}
          </div>
          <input type="number" name="bubbleMaxWidth" value="${action.bubbleMaxWidth || 220}" min="120" max="480" step="10">
        </div>
      </div>
    `;
  }

  if (type === "changeScale") {
    return `
      <div class="action-params">
        <div class="field">
          <label>${t("rules.actionParams.scale")}</label>
          <input type="number" name="scale" value="${action.scale || 1}" min="0.25" max="4" step="0.25" required>
        </div>
      </div>
    `;
  }

  if (type === "changeOpacity") {
    return `
      <div class="action-params">
        <div class="field">
          <label>${t("rules.actionParams.opacity")}</label>
          <input type="number" name="opacity" value="${action.opacity || 1}" min="0" max="1" step="0.1" required>
        </div>
      </div>
    `;
  }

  // hidePet, showPet, resetPosition, openPanel - no parameters
  return `<div class="action-params empty">${t("rules.noParams")}</div>`;
}

/**
 * Render single inline action row
 * @param {object} action - Action object
 * @param {number} index - Action index
 * @param {object} animations - Animations config
 * @returns {string} HTML for action row
 */
export function renderSingleInlineAction(action, index, animations) {
  return `
    <div class="inline-action-row" data-inline-action data-index="${index}">
      <div class="action-header">
        <span class="action-number">${index + 1}.</span>
        ${renderActionTypeSelector(action.type)}
        <button type="button" class="button-icon" data-action="remove-inline-action" title="${t("rules.removeAction")}">×</button>
      </div>
      ${renderActionParams(action, animations)}
    </div>
  `;
}

/**
 * Render inline action editor
 * @param {Array} actions - Array of action objects
 * @param {object} animations - Animations config
 * @returns {string} HTML for inline action editor
 */
export function renderInlineActionEditor(actions, animations) {
  const actionList = Array.isArray(actions) ? actions : [];

  return `
    <div class="inline-actions">
      <div class="inline-actions-list">
        ${actionList.map((action, index) => renderSingleInlineAction(action, index, animations)).join("")}
      </div>
      <button type="button" class="button-secondary" data-action="add-inline-action">
        ${t("rules.addAction")}
      </button>
    </div>
  `;
}
