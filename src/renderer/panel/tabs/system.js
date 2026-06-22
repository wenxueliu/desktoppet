/**
 * System tab
 */

import { escapeHtml, selected, checked, disabled as disabledHelper } from "../ui/utils.js";
import { renderHeader } from "../ui/header.js";
import { t, getAvailableLocales } from "../../../shared/i18n.js";

/**
 * Render system tab
 * @param {object} state - Panel state
 * @param {object} config - Configuration object
 * @returns {string} System HTML
 */
export function renderSystem(state, config) {
  const configPath = config.configPath || (config.system && config.system.configPath) || "";
  const currentLanguage = config.system?.language || "en";
  const availableLanguages = getAvailableLocales();
  const disabled = (key) => disabledHelper(key, state.savingKey);

  return `
    ${renderHeader(t("system.title"), t("system.description"))}
    <section class="panel-section">
      <div class="section-header"><h3>App</h3></div>
      <div class="section-body">
        ${configPath ? `<p class="code-line">${escapeHtml(configPath)}</p>` : `<p class="muted">Config path is not available from the current preload response.</p>`}
        <label class="toggle">
          <span>${t("system.startAtLogin")}</span>
          <input id="launch-at-login" type="checkbox" ${checked(state.systemLaunchAtLogin)} ${disabled("system")}>
        </label>
        <div class="form-row">
          <label>
            <span>${t("system.language")}</span>
            <select id="language-select" ${disabled("system")}>
              ${availableLanguages.map(lang => `
                <option value="${lang.code}" ${selected(currentLanguage, lang.code)}>
                  ${escapeHtml(lang.name)}
                </option>
              `).join("")}
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button class="button-primary" type="button" data-action="save-system" ${disabled("system")}>${state.savingKey === "system" ? t("common.saving") : t("common.save")}</button>
          <button class="button-danger" type="button" data-action="quit-app">Quit app</button>
        </div>
      </div>
    </section>
  `;
}
