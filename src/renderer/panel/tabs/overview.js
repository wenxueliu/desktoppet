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
 * Format relative time
 * @param {number} timestamp - Timestamp in ms
 * @returns {string} Relative time string
 */
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  return `${hours}h`;
}

/**
 * Get event type display name
 * @param {string} type - Event type
 * @returns {string} Display name
 */
function getEventTypeName(type) {
  return t(`rules.conditionTypes.${type}`) || type;
}

/**
 * Render runtime status section
 * @param {object|null} runtimeState - Runtime state from pet
 * @param {object} config - Config for rule names
 * @returns {string} Runtime status HTML
 */
function renderRuntimeStatus(runtimeState, config) {
  if (!runtimeState) {
    return `
      <section class="panel-section runtime-status-section">
        <div class="section-header"><h3>${t("overview.runtimeStatus")}</h3></div>
        <div class="section-body">
          <p class="hint">${t("common.loading")}</p>
        </div>
      </section>
    `;
  }

  const { currentState, recentEvents, ruleStates, timers, interactionsPaused } = runtimeState;

  // Get rule names from config
  const rules = (config && config.triggerRules) || [];
  const ruleNamesById = {};
  rules.forEach(rule => {
    if (rule && rule.id) {
      ruleNamesById[rule.id] = rule.name || rule.id;
    }
  });

  // Get animation names from config
  const animations = config?.animations || { default: { id: "idle", name: "Idle" }, clips: [] };
  const animationNamesById = {};
  if (animations.default) {
    animationNamesById[animations.default.id] = animations.default.name || animations.default.id;
  }
  (animations.clips || []).forEach(clip => {
    if (clip && clip.id) {
      animationNamesById[clip.id] = clip.name || clip.id;
    }
  });

  // Get current animation name
  const currentAnimId = currentState?.animation;
  const currentAnimName = currentAnimId ? (animationNamesById[currentAnimId] || currentAnimId) : t("overview.noAnimation");

  // Recent triggered rules (top 3)
  const ruleEntries = Object.entries(ruleStates || {})
    .map(([ruleId, timestamp]) => ({
      ruleId,
      ruleName: ruleNamesById[ruleId] || ruleId,
      timestamp
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  // Recent events (last 8)
  const events = (recentEvents || []).slice(-8).reverse();

  return `
    <section class="panel-section runtime-status-section">
      <div class="section-header"><h3>${t("overview.runtimeStatus")}</h3></div>
      <div class="section-body">
        <div class="status-grid">
          <!-- Current Animation -->
          <div class="status-card">
            <h4>${t("overview.currentAnimation")}</h4>
            <div class="animation-info">
              ${currentState && currentState.sprite ? `
                <img class="sprite-preview" src="${escapeHtml(currentState.sprite)}" alt="${escapeHtml(currentAnimName)}" />
              ` : ''}
              <div class="animation-details">
                <strong>${escapeHtml(currentAnimName)}</strong>
              </div>
            </div>
          </div>

          <!-- Recent Rules -->
          <div class="status-card">
            <h4>${t("overview.recentRules")}</h4>
            ${ruleEntries.length > 0 ? `
              <ul class="rule-list">
                ${ruleEntries.map(entry => `
                  <li>
                    <span class="rule-name">${escapeHtml(entry.ruleName)}</span>
                    <span class="rule-time">${formatRelativeTime(entry.timestamp)}</span>
                  </li>
                `).join('')}
              </ul>
            ` : `<p class="hint">${t("overview.noRulesTriggered")}</p>`}
          </div>

          <!-- Event History -->
          <div class="status-card">
            <h4>${t("overview.eventHistory")}</h4>
            ${events.length > 0 ? `
              <ul class="event-list">
                ${events.map(event => `
                  <li class="event-item event-type-${escapeHtml(event.type || 'unknown')}">
                    <span class="event-name">${getEventTypeName(event.type)}</span>
                    <span class="event-time">${formatRelativeTime(event.timestamp)}</span>
                  </li>
                `).join('')}
              </ul>
            ` : `<p class="hint">${t("overview.noEventsYet")}</p>`}
          </div>

          <!-- System Status -->
          <div class="status-card">
            <h4>${t("overview.systemStatus")}</h4>
            <div class="status-info">
              <div class="status-row">
                <span>${t("overview.position")}</span>
                <strong>${Math.round(currentState?.position?.x || 0)}, ${Math.round(currentState?.position?.y || 0)}</strong>
              </div>
              <div class="status-row">
                <span>${t("overview.display")}</span>
                <strong>${Math.round((currentState?.display?.scale || 1) * 100)}% / ${Math.round((currentState?.display?.opacity || 1) * 100)}%</strong>
              </div>
              ${interactionsPaused ? `
                <div class="status-row status-warning">
                  <span>${t("overview.interactionsPaused")}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Render overview tab
 * @param {object} config - Configuration object
 * @param {object|null} runtimeState - Runtime state from pet (optional)
 * @returns {string} Overview HTML
 */
export function renderOverview(config, runtimeState = null) {
  const display = getDisplay(config);
  const stats = getPanelOverviewStats(config);

  return `
    ${renderHeader(t("overview.title"), t("overview.description"))}
    <div class="metric-grid">
      <div class="metric"><span>${t("overview.package")}</span><strong>${escapeHtml(stats.packageId)}</strong></div>
      <div class="metric"><span>${t("overview.rules")}</span><strong>${stats.ruleCount}</strong></div>
      <div class="metric"><span>${t("overview.assets")}</span><strong>${stats.assetCount}</strong></div>
      <div class="metric"><span>${t("overview.display")}</span><strong>${stats.displayScalePercent}%</strong></div>
    </div>
    <section class="panel-section">
      <div class="section-header"><h3>${t("overview.activeDisplay")}</h3></div>
      <div class="section-body grid-3">
        <div class="field"><span class="field-label">${t("overview.opacity")}</span><span>${Math.round(display.opacity * 100)}%</span></div>
        <div class="field"><span class="field-label">${t("overview.alwaysOnTop")}</span><span>${display.alwaysOnTop ? t("overview.enabled") : t("overview.disabled")}</span></div>
        <div class="field"><span class="field-label">${t("overview.mousePassthrough")}</span><span>${display.mousePassthrough ? t("overview.enabled") : t("overview.disabled")}</span></div>
      </div>
    </section>
    ${renderRuntimeStatus(runtimeState, config)}
  `;
}

/**
 * Update runtime status section only (called when state updates)
 * @param {object|null} runtimeState - Runtime state from pet
 * @param {object} config - Config for rule names
 */
export function updateRuntimeStatus(runtimeState, config) {
  const section = document.querySelector('.runtime-status-section');
  if (!section) return;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderRuntimeStatus(runtimeState, config);
  const newSection = tempDiv.querySelector('.runtime-status-section');

  if (newSection) {
    section.replaceWith(newSection);
  }
}

