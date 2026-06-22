/**
 * Overview tab
 */

import { escapeHtml } from "../ui/utils.js";
import { renderHeader } from "../ui/header.js";
import { t } from "../../../shared/i18n.js";
import { getPanelOverviewStats } from "../panel-state.js";
import { DEFAULT_DISPLAY } from "../panel-state.js";

/**
 * Get display settings with defaults
 * @param {object} config - Configuration object
 * @returns {object} Display settings
 */
function getDisplay(config) {
  return {
    ...DEFAULT_DISPLAY,
    ...(config && config.display ? config.display : {})
  };
}

/**
 * Render overview tab
 * @param {object} config - Configuration object
 * @returns {string} Overview HTML
 */
export function renderOverview(config) {
  const display = getDisplay(config);
  const stats = getPanelOverviewStats(config);

  return `
    ${renderHeader(t("overview.title"), t("overview.description"))}
    <div class="metric-grid">
      <div class="metric"><span>${t("overview.package")}</span><strong>${escapeHtml(stats.packageId)}</strong></div>
      <div class="metric"><span>${t("overview.rules")}</span><strong>${stats.ruleCount}</strong></div>
      <div class="metric"><span>${t("overview.assets")}</span><strong>${stats.assetCount}</strong></div>
      <div class="metric"><span>${t("overview.display")}</span><strong>${stats.displayScalePercent}%</strong></div>
      <div class="metric"><span>${t("overview.system")}</span><strong>${stats.launchAtLogin ? t("overview.systemLogin") : t("overview.systemManual")}</strong></div>
    </div>
    <section class="panel-section">
      <div class="section-header"><h3>${t("overview.activeDisplay")}</h3></div>
      <div class="section-body grid-3">
        <div class="field"><span class="field-label">${t("overview.opacity")}</span><span>${Math.round(display.opacity * 100)}%</span></div>
        <div class="field"><span class="field-label">${t("overview.alwaysOnTop")}</span><span>${display.alwaysOnTop ? t("overview.enabled") : t("overview.disabled")}</span></div>
        <div class="field"><span class="field-label">${t("overview.mousePassthrough")}</span><span>${display.mousePassthrough ? t("overview.enabled") : t("overview.disabled")}</span></div>
      </div>
    </section>
  `;
}
