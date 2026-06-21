import {
  BASIC_STATE_TYPES,
  DEFAULT_DISPLAY,
  FIELD_INPUT_TYPES,
  SUPPORTED_ACTION_TYPES,
  SUPPORTED_OPERATORS,
  SUPPORTED_RELATIONS,
  TRIGGER_PARAMETER_FIELDS,
  buildActionFromForm,
  buildRuleConditionFromForm,
  buildRuleFromForm,
  buildStateFromForm,
  createId,
  deleteConfigAction,
  deleteConfigRule,
  getConfigStates,
  getPanelOverviewStats,
  getFieldsForCondition,
  removeConfigAssetReferences,
  updateConfigAction,
  updateConfigDisplay,
  updateConfigInteractions,
  updateConfigRule,
  updateConfigState,
  updateConfigSystem,
  validateRuleForm
} from "./panel-state.js";
import { t, setLocale, initLocale, getAvailableLocales } from "../../shared/i18n.js";

// Initialize locale from config or browser
initLocale();

const TABS = [
  ["overview", () => t("panel.tabs.overview")],
  ["assets", () => t("panel.tabs.assets")],
  ["states", () => t("panel.tabs.states")],
  ["actions", () => t("panel.tabs.actions")],
  ["interaction", () => t("panel.tabs.interaction")],
  ["rules", () => t("panel.tabs.rules")],
  ["display", () => t("panel.tabs.display")],
  ["system", () => t("panel.tabs.system")]
];

const IMAGE_ASSET_EXTENSIONS = [".gif", ".webp", ".png", ".svg"];
const VIDEO_ASSET_EXTENSIONS = [".webm", ".mp4", ".mov"];
const ASSET_BINDING_TARGETS = [
  ["custom", () => t("assets.bindTarget.custom"), false],
  ["idle", () => t("assets.bindTarget.idle"), false],
  ["click", () => t("assets.bindTarget.click"), false],
  ["drag", () => t("assets.bindTarget.drag"), false]
];

const state = {
  activeTab: "overview",
  config: null,
  savingKey: "",
  selectedStateType: "idle",
  selectedStateEntryId: "",
  selectedActionId: "",
  selectedRuleId: "",
  selectedConditionType: Object.keys(TRIGGER_PARAMETER_FIELDS)[0],
  selectedAssetPath: "",
  selectedAssetPackageId: "",
  selectedAssetBindingTarget: "custom",
  selectedAssetActionId: "",
  selectedAssetResult: null,
  petpackResult: null,
  systemLaunchAtLogin: false
};

const api = window.desktopPetPanel;
const tabsEl = document.querySelector("#tabs");
const rootEl = document.querySelector("#panel-root");
const bannerEl = document.querySelector("#banner");
const versionEl = document.querySelector("#panel-version");

versionEl.textContent = api && api.version ? `v${api.version}` : "preload unavailable";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selected(current, expected) {
  return current === expected ? "selected" : "";
}

function checked(value) {
  return value ? "checked" : "";
}

function disabled(key) {
  return state.savingKey === key ? "disabled" : "";
}

function getActionAsset(action) {
  return action.asset || action.assetPath || "";
}

function getPathFilename(filePath) {
  return String(filePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
}

function getPathExtension(filePath) {
  const filename = getPathFilename(filePath);
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function toFilePreviewUrl(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  const prefix = normalized.startsWith("/") ? "file://" : "file:///";
  return `${prefix}${normalized.split("/").map(encodeURIComponent).join("/")}`.replace("%3A", ":");
}

function showBanner(message, tone = "error") {
  bannerEl.textContent = message;
  bannerEl.classList.toggle("success", tone === "success");
  bannerEl.hidden = false;
  if (tone === "success") {
    window.setTimeout(() => {
      bannerEl.hidden = true;
    }, 2200);
  }
}

function hideBanner() {
  bannerEl.hidden = true;
  bannerEl.textContent = "";
  bannerEl.classList.remove("success");
}

function setFormSaving(form, isSaving) {
  form.querySelectorAll("button, input, select, textarea").forEach((control) => {
    control.disabled = isSaving;
  });
}

function getDisplay() {
  return {
    ...DEFAULT_DISPLAY,
    ...(state.config && state.config.display ? state.config.display : {})
  };
}

function getActions() {
  return Array.isArray(state.config && state.config.customActions) ? state.config.customActions : [];
}

function getRules() {
  return Array.isArray(state.config && state.config.triggerRules) ? state.config.triggerRules : [];
}

function normalizeConditionForEditor(condition) {
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

function getRuleConditionsForEditor(rule) {
  if (rule && Array.isArray(rule.conditions) && rule.conditions.length > 0) {
    return rule.conditions.map(normalizeConditionForEditor);
  }
  if (rule && rule.trigger) {
    return [{ type: rule.trigger, filters: Array.isArray(rule.filters) ? rule.filters : [] }];
  }
  return [{ type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }];
}

function getStates() {
  return getConfigStates(state.config);
}

function getInteractions() {
  const interactions = state.config && state.config.interactions && typeof state.config.interactions === "object"
    ? state.config.interactions
    : {};
  const bubble = interactions.bubble && typeof interactions.bubble === "object" ? interactions.bubble : {};

  return {
    clickMessages: Array.isArray(interactions.clickMessages) ? interactions.clickMessages : [],
    randomMessages: Array.isArray(interactions.randomMessages) ? interactions.randomMessages : [],
    timedMessages: Array.isArray(interactions.timedMessages) ? interactions.timedMessages : [],
    importSuccessMessage: interactions.importSuccessMessage || "",
    bubble: {
      maxWidth: Number.isFinite(Number(bubble.maxWidth)) ? Number(bubble.maxWidth) : 220,
      durationMs: Number.isFinite(Number(bubble.durationMs)) ? Number(bubble.durationMs) : 1800,
      showCloseButton: Boolean(bubble.showCloseButton)
    }
  };
}

function getAssetPackageId() {
  return state.selectedAssetPackageId || (state.config && state.config.currentPackageId) || "default-pet";
}

function getReferencedAssets() {
  const assets = new Set();
  Object.values(getStates()).forEach((entries) => {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => {
      const asset = entry && (entry.asset || entry.assetPath);
      if (asset) assets.add(asset);
    });
  });
  getActions().forEach((action) => {
    const asset = action && (action.asset || action.assetPath);
    if (asset) assets.add(asset);
  });
  return [...assets].sort();
}

function renderTabs() {
  tabsEl.innerHTML = TABS.map(([id, labelFn]) => `
    <button class="tab-button" type="button" data-tab="${id}" aria-selected="${state.activeTab === id}">
      ${escapeHtml(labelFn())}
    </button>
  `).join("");
}

function render() {
  renderTabs();

  if (!state.config) {
    rootEl.innerHTML = `<div class="empty-state">Loading configuration...</div>`;
    return;
  }

  const views = {
    overview: renderOverview,
    assets: renderAssets,
    states: renderStates,
    actions: renderActions,
    interaction: renderInteraction,
    rules: renderRules,
    display: renderDisplay,
    system: renderSystem
  };

  rootEl.innerHTML = views[state.activeTab]();
}

function renderHeader(title, description, action = "") {
  return `
    <div class="view-header">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      ${action}
    </div>
  `;
}

function renderOverview() {
  const display = getDisplay();
  const stats = getPanelOverviewStats(state.config);

  return `
    ${renderHeader(t("overview.title"), t("overview.description"))}
    <div class="metric-grid">
      <div class="metric"><span>${t("overview.package")}</span><strong>${escapeHtml(stats.packageId)}</strong></div>
      <div class="metric"><span>${t("overview.states")}</span><strong>${stats.stateCount}</strong></div>
      <div class="metric"><span>${t("overview.actions")}</span><strong>${stats.actionCount}</strong></div>
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

function renderAssets() {
  const actions = getActions();
  const selectedActionId = state.selectedAssetActionId || (actions[0] && actions[0].id) || "";
  const sourcePath = state.selectedAssetPath;
  const sourceName = getPathFilename(sourcePath);
  const ext = getPathExtension(sourcePath);
  const result = state.selectedAssetResult;
  const petpackResult = state.petpackResult;
  const currentPackageId = (state.config && state.config.currentPackageId) || "default-pet";
  const canImport = sourcePath && (state.selectedAssetBindingTarget !== "custom" || selectedActionId);
  const referencedAssets = getReferencedAssets();

  return `
    ${renderHeader(t("assets.title"), t("assets.description"))}
    <section class="panel-section">
      <div class="section-header"><h3>${t("assets.import.title")}</h3></div>
      <div class="section-body">
        <form id="asset-import-form">
          <div class="asset-grid">
            <div class="asset-preview">
              ${renderAssetPreview(sourcePath, ext)}
            </div>
            <div class="asset-controls">
              <div class="form-actions flush">
                <button type="button" data-action="pick-asset">${t("assets.import.chooseFile")}</button>
                <button class="button-primary" type="submit" ${canImport ? "" : "disabled"} ${disabled("asset")}>${state.savingKey === "asset" ? t("common.importing") : t("assets.import.button")}</button>
              </div>
              <div class="field">
                <span class="field-label">${t("assets.import.selectedFile")}</span>
                ${sourcePath ? `
                  <strong>${escapeHtml(sourceName)}</strong>
                  <code class="code-line breakable">${escapeHtml(sourcePath)}</code>
                ` : `<span class="muted">${t("assets.import.noFileSelected")}</span>`}
              </div>
              <div class="grid-2">
                <div class="field">
                  <label for="asset-package-id">${t("assets.import.package")}</label>
                  <input id="asset-package-id" name="packageId" type="text" value="${escapeHtml(getAssetPackageId())}">
                </div>
                <div class="field">
                  <label for="asset-binding-target">${t("assets.import.bindTo")}</label>
                  <select id="asset-binding-target" name="bindingTarget">
                    ${ASSET_BINDING_TARGETS.map(([value, labelFn, isDisabled]) => `<option value="${escapeHtml(value)}" ${selected(state.selectedAssetBindingTarget, value)} ${isDisabled ? "disabled" : ""}>${escapeHtml(labelFn())}</option>`).join("")}
                  </select>
                </div>
                <div class="field">
                  <label for="asset-action-id">${t("assets.import.customAction")}</label>
                  <select id="asset-action-id" name="actionId">
                    ${actions.length
    ? actions.map((action) => `<option value="${escapeHtml(action.id)}" ${selected(selectedActionId, action.id)}>${escapeHtml(action.name || action.id)}</option>`).join("")
    : `<option value="">${t("assets.import.noCustomActions")}</option>`}
                  </select>
                  <small>${t("assets.import.bindingHint")}</small>
                </div>
              </div>
              ${result ? renderAssetResult(result) : ""}
            </div>
          </div>
        </form>
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${t("assets.petpack.title")}</h3></div>
      <div class="section-body">
        <div class="form-actions flush">
          <button type="button" data-action="import-petpack" ${disabled("petpack-import")}>${state.savingKey === "petpack-import" ? t("common.importing") : t("assets.petpack.import")}</button>
          <button type="button" data-action="export-petpack" ${disabled("petpack-export")}>${state.savingKey === "petpack-export" ? t("common.exporting") : t("assets.petpack.export")}</button>
        </div>
        <p class="muted">${t("assets.petpack.currentPackage")} ${escapeHtml(currentPackageId)}</p>
        ${petpackResult ? renderPetpackResult(petpackResult) : ""}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${t("assets.referenced.title")}</h3><span class="muted">${referencedAssets.length === 1 ? t("assets.referenced.count", {count: referencedAssets.length}) : t("assets.referenced.countPlural", {count: referencedAssets.length})}</span></div>
      <div class="section-body">
        ${referencedAssets.length ? `<div class="item-list">${referencedAssets.map((asset) => `
          <div class="item-row">
            <div><code>${escapeHtml(asset)}</code></div>
            <button type="button" data-action="delete-asset" data-asset="${escapeHtml(asset)}">${t("common.delete")}</button>
          </div>
        `).join("")}</div>` : `<div class="empty-state">${t("assets.referenced.empty")}</div>`}
      </div>
    </section>
  `;
}

function renderAssetPreview(sourcePath, ext) {
  if (!sourcePath) {
    return `<div class="empty-state compact">${t("assets.referenced.preview")}</div>`;
  }

  const src = toFilePreviewUrl(sourcePath);
  if (IMAGE_ASSET_EXTENSIONS.includes(ext)) {
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(getPathFilename(sourcePath))}">`;
  }

  if (VIDEO_ASSET_EXTENSIONS.includes(ext)) {
    return `<video src="${escapeHtml(src)}" controls muted loop playsinline></video>`;
  }

  return `<div class="empty-state compact">Preview unavailable for ${escapeHtml(ext || "this file")}.</div>`;
}

function renderAssetResult(result) {
  const ok = result && result.ok;
  const message = ok
    ? `Imported ${result.asset}.`
    : (result && result.error) || "Import failed.";

  return `<div class="asset-result ${ok ? "success" : "error"}">${escapeHtml(message)}</div>`;
}

function renderPetpackResult(result) {
  const ok = result && result.ok;
  const message = ok
    ? (result.targetPath
      ? `Exported ${result.packageId} to ${result.targetPath}.`
      : `Imported ${result.packageId}.`)
    : (result && result.error) || "Petpack operation failed.";

  return `<div class="asset-result ${ok ? "success" : "error"}">${escapeHtml(message)}</div>`;
}

function renderStates() {
  const states = getStates();
  const stateType = state.selectedStateType || "idle";
  const entries = states[stateType] || [];
  const selectedEntry = entries.find((entry) => entry.id === state.selectedStateEntryId) || entries[0] || null;
  const formState = selectedEntry || {
    id: `${stateType}-default`,
    name: "",
    asset: "",
    message: "",
    loop: stateType === "idle" || stateType === "drag",
    weight: 1,
    durationMs: "",
    returnToState: stateType === "idle" ? "" : "idle"
  };

  return `
    ${renderHeader(t("states.title"), t("states.description"), `
      <button type="button" data-action="new-state-entry">${t("states.addNew")}</button>
    `)}
    <section class="panel-section">
      <div class="section-header"><h3>${t("states.builtIn")}</h3><span class="muted">${BASIC_STATE_TYPES.length} ${t("states.available")}</span></div>
      <div class="section-body state-grid">
        ${BASIC_STATE_TYPES.map((stateTypeInfo) => renderStateCard(stateTypeInfo, states[stateTypeInfo.id] || [])).join("")}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${selectedEntry ? t("states.editBinding") : t("states.createBinding")}</h3><span class="muted">${escapeHtml(stateType)}</span></div>
      <div class="section-body">
        <form id="state-form">
          <div class="grid-3">
            <div class="field">
              <label for="state-type">State</label>
              <select id="state-type" name="stateType">
                ${BASIC_STATE_TYPES.map((stateTypeInfo) => `<option value="${escapeHtml(stateTypeInfo.id)}" ${selected(stateType, stateTypeInfo.id)}>${escapeHtml(stateTypeInfo.name)} (${escapeHtml(stateTypeInfo.id)})</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="state-id">${t("states.bindingId")}</label>
              <input id="state-id" name="id" type="text" value="${escapeHtml(formState.id)}" required>
            </div>
            <div class="field">
              <label for="state-name">${t("states.displayName")}</label>
              <input id="state-name" name="name" type="text" value="${escapeHtml(formState.name || "")}" placeholder="${escapeHtml(stateType)}">
            </div>
            <div class="field">
              <label for="state-asset">${t("states.assetPath")}</label>
              <input id="state-asset" name="asset" type="text" value="${escapeHtml(formState.asset || formState.assetPath || "")}" placeholder="assets/${escapeHtml(stateType)}.webm" required>
            </div>
            <label class="toggle">
              <span>${t("states.form.loop")}</span>
              <input name="loop" type="checkbox" ${checked(formState.loop)}>
            </label>
            <div class="field">
              <label for="state-weight">${t("states.weight")}</label>
              <input id="state-weight" name="weight" type="number" min="0" step="1" value="${escapeHtml(formState.weight ?? "")}">
            </div>
            <div class="field">
              <label for="state-duration">${t("states.duration")}</label>
              <input id="state-duration" name="durationMs" type="number" min="0" step="50" value="${escapeHtml(formState.durationMs ?? "")}">
            </div>
            <div class="field">
              <label for="state-return">${t("states.returnToState")}</label>
              <input id="state-return" name="returnToState" type="text" value="${escapeHtml(formState.returnToState || "")}" placeholder="idle">
            </div>
            <div class="field">
              <label for="state-message">${t("states.message")}</label>
              <textarea id="state-message" name="message">${escapeHtml(formState.message || "")}</textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="button-primary" type="submit" ${disabled("state")}>${state.savingKey === "state" ? t("common.saving") : t("common.save")}</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderStateCard(stateTypeInfo, entries) {
  const primary = entries[0] || null;
  const asset = primary && (primary.asset || primary.assetPath);

  return `
    <button class="state-card" type="button" data-action="select-state" data-state-type="${escapeHtml(stateTypeInfo.id)}" data-state-entry-id="${escapeHtml(primary && primary.id ? primary.id : "")}" aria-selected="${state.selectedStateType === stateTypeInfo.id}">
      <span>
        <strong>${escapeHtml(stateTypeInfo.name)}</strong>
        <small>${escapeHtml(stateTypeInfo.description)}</small>
      </span>
      <code>${asset ? escapeHtml(asset) : "No asset bound"}</code>
      <span class="muted">${entries.length} binding${entries.length === 1 ? "" : "s"}</span>
    </button>
  `;
}

function renderActions() {
  const actions = getActions();
  const selectedAction = actions.find((action) => action.id === state.selectedActionId) || null;
  const formAction = selectedAction || {
    id: createId("action"),
    name: "",
    type: "playAnimation",
    asset: "",
    loop: false,
    returnToState: "",
    message: "",
    durationMs: "",
    weight: 1
  };

  return `
    ${renderHeader(t("actions.title"), t("actions.description"), `
      <button type="button" data-action="new-action">${t("actions.addNew")}</button>
    `)}
    <section class="panel-section">
      <div class="section-header"><h3>${t("actions.customActions")}</h3><span class="muted">${actions.length} ${t("actions.saved")}</span></div>
      <div class="section-body">
        ${actions.length ? `<div class="item-list">${actions.map(renderActionRow).join("")}</div>` : `<div class="empty-state">${t("actions.empty")}</div>`}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${selectedAction ? t("actions.editAction") : t("actions.createAction")}</h3></div>
      <div class="section-body">
        <form id="action-form">
          <input type="hidden" name="id" value="${escapeHtml(formAction.id)}">
          <div class="grid-2">
            <div class="field">
              <label for="action-name">${t("actions.form.name")}</label>
              <input id="action-name" name="name" type="text" value="${escapeHtml(formAction.name)}" required>
            </div>
            <div class="field">
              <label for="action-type">${t("actions.form.type")}</label>
              <select id="action-type" name="type">
                ${SUPPORTED_ACTION_TYPES.map((type) => `<option value="${escapeHtml(type)}" ${selected(formAction.type, type)}>${escapeHtml(type)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="action-asset">${t("actions.form.assetPath")}</label>
              <input id="action-asset" name="asset" type="text" value="${escapeHtml(getActionAsset(formAction))}" placeholder="assets/idle.svg">
            </div>
            <div class="field">
              <label for="action-return-state">${t("actions.form.returnToState")}</label>
              <input id="action-return-state" name="returnToState" type="text" value="${escapeHtml(formAction.returnToState)}" placeholder="idle">
            </div>
            <label class="toggle">
              <span>${t("states.form.loop")}</span>
              <input name="loop" type="checkbox" ${checked(formAction.loop)}>
            </label>
            <div class="field">
              <label for="action-weight">${t("actions.form.weight")}</label>
              <input id="action-weight" name="weight" type="number" min="0" step="1" value="${escapeHtml(formAction.weight ?? "")}">
            </div>
            <div class="field">
              <label for="action-duration">${t("states.duration")}</label>
              <input id="action-duration" name="durationMs" type="number" min="0" step="50" value="${escapeHtml(formAction.durationMs ?? "")}">
            </div>
            <div class="field">
              <label for="action-message">${t("actions.form.message")}</label>
              <textarea id="action-message" name="message">${escapeHtml(formAction.message)}</textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="button-primary" type="submit" ${disabled("action")}>${state.savingKey === "action" ? t("common.saving") : t("common.save")}</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderActionRow(action) {
  return `
    <div class="item-row">
      <div>
        <strong>${escapeHtml(action.name || t("actions.untitled"))}</strong>
        <code>${escapeHtml(action.id)} · ${escapeHtml(action.type || "unknown")}${getActionAsset(action) ? ` · ${escapeHtml(getActionAsset(action))}` : ""}</code>
      </div>
      <button type="button" data-action="edit-action" data-id="${escapeHtml(action.id)}">${t("actions.edit")}</button>
      <button type="button" data-action="delete-action" data-id="${escapeHtml(action.id)}">${t("common.delete")}</button>
    </div>
  `;
}

function linesToTextarea(messages) {
  return (Array.isArray(messages) ? messages : []).join("\n");
}

function renderInteraction() {
  const interactions = getInteractions();

  return `
    ${renderHeader(t("interaction.title"), t("interaction.description"))}
    <section class="panel-section">
      <div class="section-header"><h3>${t("interaction.messagesAndBubble")}</h3></div>
      <div class="section-body">
        <form id="interaction-form">
          <div class="grid-2">
            <div class="field">
              <label for="interaction-click-messages">${t("interaction.clickMessage")}</label>
              <textarea id="interaction-click-messages" name="clickMessages" rows="5">${escapeHtml(linesToTextarea(interactions.clickMessages))}</textarea>
            </div>
            <div class="field">
              <label for="interaction-random-messages">${t("interaction.randomIdleMessages")}</label>
              <textarea id="interaction-random-messages" name="randomMessages" rows="5">${escapeHtml(linesToTextarea(interactions.randomMessages))}</textarea>
            </div>
            <div class="field">
              <label for="interaction-timed-messages">${t("interaction.timedReminderMessages")}</label>
              <textarea id="interaction-timed-messages" name="timedMessages" rows="5">${escapeHtml(linesToTextarea(interactions.timedMessages))}</textarea>
            </div>
            <div class="field">
              <label for="interaction-import-success">${t("interaction.importSuccessMessage")}</label>
              <input id="interaction-import-success" name="importSuccessMessage" type="text" value="${escapeHtml(interactions.importSuccessMessage)}">
            </div>
            <div class="field">
              <label for="interaction-bubble-width">${t("interaction.bubbleMaxWidth")}</label>
              <input id="interaction-bubble-width" name="bubbleMaxWidth" type="number" min="120" max="480" step="10" value="${escapeHtml(interactions.bubble.maxWidth)}">
            </div>
            <div class="field">
              <label for="interaction-bubble-duration">${t("interaction.bubbleDuration")}</label>
              <input id="interaction-bubble-duration" name="bubbleDurationMs" type="number" min="500" max="10000" step="100" value="${escapeHtml(interactions.bubble.durationMs)}">
            </div>
            <label class="checkbox-row">
              <input name="bubbleShowCloseButton" type="checkbox" ${checked(interactions.bubble.showCloseButton)}>
              <span>${t("interaction.showBubbleCloseButton")}</span>
            </label>
          </div>
          <div class="form-actions">
            <button class="button-primary" type="submit" ${disabled("interaction")}>${state.savingKey === "interaction" ? t("common.saving") : t("common.save")}</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderRules() {
  const rules = getRules();
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
    actionIds: Array.isArray(selectedRule.actions) ? selectedRule.actions : []
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
    actionIds: []
  };

  return `
    ${renderHeader(t("rules.title"), t("rules.description"), `
      <button type="button" data-action="new-rule">${t("rules.addNew")}</button>
    `)}
    ${renderConditionBrowser()}
    <section class="panel-section">
      <div class="section-header"><h3>${t("rules.savedRules")}</h3><span class="muted">${rules.length} ${t("rules.saved")}</span></div>
      <div class="section-body">
        ${rules.length ? `<div class="item-list">${rules.map(renderRuleRow).join("")}</div>` : `<div class="empty-state">${t("rules.empty")}</div>`}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${selectedRule ? t("rules.editRule") : t("rules.createRule")}</h3></div>
      <div class="section-body">
        <form id="rule-form">
          <input type="hidden" name="id" value="${escapeHtml(formRule.id)}">
          <div class="grid-3">
            <div class="field">
              <label for="rule-name">${t("rules.form.name")}</label>
              <input id="rule-name" name="name" type="text" value="${escapeHtml(formRule.name)}" required>
            </div>
            <label class="toggle">
              <span>${t("rules.form.enabled")}</span>
              <input name="enabled" type="checkbox" ${checked(formRule.enabled)}>
            </label>
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
            <div class="field wide">
              <span class="field-label">${t("rules.form.conditions")}</span>
              <div id="rule-conditions" class="stack-list">
                ${formRule.conditions.map((condition, index) => renderRuleConditionEditor(condition, index)).join("")}
              </div>
              <button type="button" data-action="add-rule-condition">${t("rules.form.addCondition")}</button>
            </div>
            <div class="field">
              <label for="rule-action-strategy">${t("rules.actionStrategy")}</label>
              <select id="rule-action-strategy" name="actionStrategy">
                <option value="sequence" ${selected(formRule.actionStrategy, "sequence")}>${t("rules.sequence")}</option>
                <option value="random" ${selected(formRule.actionStrategy, "random")}>${t("rules.random")}</option>
              </select>
            </div>
            <div class="field">
              <span class="field-label">${t("rules.form.actions")}</span>
              ${renderRuleActionSelector(formRule.actionIds)}
            </div>
          </div>
          <div class="form-actions">
            <button class="button-primary" type="submit" ${disabled("rule")}>${state.savingKey === "rule" ? t("common.saving") : t("common.save")}</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderRuleRow(rule) {
  const conditionSummary = Array.isArray(rule.conditions)
    ? rule.conditions.map((condition) => typeof condition === "string" ? condition : condition.type).join(", ")
    : "";

  return `
    <div class="item-row">
      <div>
        <strong>${escapeHtml(rule.name || "Untitled rule")} ${rule.enabled === false ? "(disabled)" : ""}</strong>
        <code>${escapeHtml(rule.id)} · ${escapeHtml(rule.relation || "single")} · ${escapeHtml(conditionSummary)} · priority ${escapeHtml(rule.priority ?? 0)}</code>
      </div>
      <button type="button" data-action="edit-rule" data-id="${escapeHtml(rule.id)}">${t("rules.edit")}</button>
      <button type="button" data-action="delete-rule" data-id="${escapeHtml(rule.id)}">${t("common.delete")}</button>
    </div>
  `;
}

function renderRuleConditionEditor(condition, index) {
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
          <label for="rule-condition-type-${index}">Condition type</label>
          <select id="rule-condition-type-${index}" name="conditionType" data-role="condition-type">
            ${Object.keys(TRIGGER_PARAMETER_FIELDS).map((type) => `<option value="${escapeHtml(type)}" ${selected(normalizedCondition.type, type)}>${escapeHtml(type)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="rule-filter-field-${index}">Filter field</label>
          <select id="rule-filter-field-${index}" name="filterField" data-role="filter-field">
            <option value="" ${selected(filterField, "")}>No filter</option>
            ${supportedFields.map((field) => `<option value="${escapeHtml(field)}" ${selected(filterField, field)}>${escapeHtml(field)} (${escapeHtml(FIELD_INPUT_TYPES[field] || "text")})</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="rule-filter-operator-${index}">Operator</label>
          <select id="rule-filter-operator-${index}" name="filterOperator">
            ${SUPPORTED_OPERATORS.map((operator) => `<option value="${escapeHtml(operator)}" ${selected(filterOperator, operator)}>${escapeHtml(operator)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="rule-filter-value-${index}">Filter value</label>
          <input id="rule-filter-value-${index}" name="filterValue" type="text" value="${escapeHtml(filterValue)}">
          <small>Use comma-separated values for between, in, and notIn.</small>
        </div>
        <div class="field">
          <label for="rule-filter-unit-${index}">Unit</label>
          <input id="rule-filter-unit-${index}" name="filterUnit" type="text" value="${escapeHtml(firstFilter.unit || "")}" placeholder="px, px/s, ms">
        </div>
        <div class="field align-end">
          <button type="button" data-action="remove-rule-condition" ${canRemove ? "" : "disabled"}>Remove</button>
        </div>
      </div>
    </div>
  `;
}

function renderRuleActionSelector(selectedActionIds) {
  const actions = getActions();
  const selectedIds = new Set(selectedActionIds);

  if (actions.length === 0) {
    return `<div class="empty-state compact">${t("rules.noActionsWarning")}</div>`;
  }

  return `
    <div class="checkbox-list">
      ${actions.map((action) => `
        <label class="checkbox-row">
          <input name="actionIds" type="checkbox" value="${escapeHtml(action.id)}" ${checked(selectedIds.has(action.id))}>
          <span>
            <strong>${escapeHtml(action.name || action.id)}</strong>
            <code>${escapeHtml(action.id)}</code>
          </span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderConditionBrowser() {
  const fields = TRIGGER_PARAMETER_FIELDS[state.selectedConditionType] || [];

  return `
    <section class="panel-section">
      <div class="section-header"><h3>Built-in Condition Browser</h3></div>
      <div class="section-body browser-grid">
        <div class="condition-list">
          ${Object.keys(TRIGGER_PARAMETER_FIELDS).map((type) => `
            <button class="condition-button" type="button" data-action="select-condition" data-condition="${escapeHtml(type)}" aria-selected="${state.selectedConditionType === type}">
              ${escapeHtml(type)}
            </button>
          `).join("")}
        </div>
        <div>
          <table class="table">
            <thead><tr><th>Field</th><th>Expected input</th></tr></thead>
            <tbody>
              ${fields.map((field) => `
                <tr>
                  <td><code>${escapeHtml(field)}</code></td>
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

function renderDisplay() {
  const display = getDisplay();

  return `
    ${renderHeader(t("display.title"), t("display.description"))}
    <section class="panel-section">
      <div class="section-header"><h3>${t("display.settings.title")}</h3></div>
      <div class="section-body">
        <form id="display-form">
          <div class="grid-2">
            <div class="field">
              <label for="display-scale">${t("display.scale")} <span id="scale-value">${Math.round(display.scale * 100)}%</span></label>
              <input id="display-scale" name="scale" type="range" min="50" max="150" step="1" value="${Math.round(display.scale * 100)}">
            </div>
            <div class="field">
              <label for="display-opacity">${t("display.opacity")} <span id="opacity-value">${Math.round(display.opacity * 100)}%</span></label>
              <input id="display-opacity" name="opacity" type="range" min="50" max="100" step="1" value="${Math.round(display.opacity * 100)}">
            </div>
            <label class="toggle">
              <span>${t("display.alwaysOnTop")}</span>
              <input name="alwaysOnTop" type="checkbox" ${checked(display.alwaysOnTop)}>
            </label>
            <label class="toggle">
              <span>${t("display.mousePassthrough")}</span>
              <input name="mousePassthrough" type="checkbox" ${checked(display.mousePassthrough)}>
            </label>
            <label class="toggle">
              <span>Show hover buttons</span>
              <input name="showHoverButtons" type="checkbox" ${checked(display.showHoverButtons)}>
            </label>
          </div>
          <div class="form-actions">
            <button class="button-primary" type="submit" ${disabled("display")}>${state.savingKey === "display" ? t("common.saving") : t("common.save")}</button>
            <button type="button" data-action="reset-position" ${disabled("display")}>${t("display.resetPosition")}</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderSystem() {
  const configPath = state.config.configPath || (state.config.system && state.config.system.configPath) || "";
  const currentLanguage = state.config.system?.language || "en";
  const availableLanguages = getAvailableLocales();

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

async function loadConfig() {
  if (!api || !api.config || !api.config.load) {
    showBanner("Panel preload API is unavailable.");
    return;
  }

  try {
    state.config = await api.config.load();

    // Initialize locale from config
    if (state.config.system?.language) {
      setLocale(state.config.system.language);
    }

    // Update page title
    const titleEl = document.querySelector("#page-title");
    if (titleEl) {
      titleEl.textContent = t("panel.title");
    }

    if (api.system && api.system.getLaunchAtLogin) {
      state.systemLaunchAtLogin = await api.system.getLaunchAtLogin();
    } else {
      state.systemLaunchAtLogin = Boolean(state.config.system && state.config.system.launchAtLogin);
    }
    hideBanner();
  } catch (error) {
    showBanner(`Could not load config: ${error.message || error}`);
  } finally {
    render();
  }
}

async function saveConfig(nextConfig, key) {
  if (state.savingKey) return null;
  state.savingKey = key;

  try {
    const savedConfig = await api.config.save(nextConfig);
    state.config = savedConfig;
    state.savingKey = "";
    showBanner("Saved.", "success");
    render();
    return savedConfig;
  } catch (error) {
    showBanner(`Save failed: ${error.message || error}`);
    return null;
  } finally {
    if (state.savingKey === key) {
      state.savingKey = "";
    }
  }
}

async function saveDisplayFromForm(form) {
  const formData = new FormData(form);
  const nextDisplay = {
    scale: Number(formData.get("scale")) / 100,
    opacity: Number(formData.get("opacity")) / 100,
    alwaysOnTop: form.elements.alwaysOnTop.checked,
    mousePassthrough: form.elements.mousePassthrough.checked,
    showHoverButtons: form.elements.showHoverButtons.checked
  };
  const nextConfig = updateConfigDisplay(state.config, nextDisplay);
  const savedConfig = await saveConfig(nextConfig, "display");

  if (savedConfig) {
    await Promise.all([
      api.pet.applyDisplay(savedConfig.display || nextDisplay),
      api.pet.setAlwaysOnTop(nextDisplay.alwaysOnTop),
      api.pet.setMousePassthrough(nextDisplay.mousePassthrough)
    ]);
  }
}

async function resetPosition() {
  const nextConfig = updateConfigDisplay(state.config, {
    x: DEFAULT_DISPLAY.x,
    y: DEFAULT_DISPLAY.y
  });
  const savedConfig = await saveConfig(nextConfig, "display");
  if (savedConfig && api.pet && api.pet.resetPosition) {
    await api.pet.resetPosition({
      x: DEFAULT_DISPLAY.x,
      y: DEFAULT_DISPLAY.y
    });
  }
}

async function setLaunchAtLogin(enabled) {
  if (!api || !api.system || !api.system.setLaunchAtLogin) {
    showBanner("Startup API is unavailable.");
    render();
    return;
  }

  state.savingKey = "system";
  render();

  try {
    state.systemLaunchAtLogin = await api.system.setLaunchAtLogin(enabled);
    if (state.config) {
      state.config = updateConfigSystem(state.config, { launchAtLogin: state.systemLaunchAtLogin });
    }
    showBanner("Saved.", "success");
  } catch (error) {
    showBanner(`Startup setting failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

async function saveStateFromForm(form) {
  const stateType = form.elements.stateType.value;
  const stateEntry = buildStateFromForm({
    stateType,
    id: form.elements.id.value,
    name: form.elements.name.value,
    asset: form.elements.asset.value,
    message: form.elements.message.value,
    loop: form.elements.loop.checked,
    weight: form.elements.weight.value,
    durationMs: form.elements.durationMs.value,
    returnToState: form.elements.returnToState.value
  });

  if (!stateEntry.asset) {
    showBanner("Choose or enter an asset path before saving a state.");
    return;
  }

  const savedConfig = await saveConfig(updateConfigState(state.config, stateType, stateEntry), "state");

  if (savedConfig) {
    state.selectedStateType = stateType;
    state.selectedStateEntryId = stateEntry.id;
    render();
  }
}

async function saveActionFromForm(form) {
  const action = buildActionFromForm({
    id: form.elements.id.value,
    name: form.elements.name.value,
    type: form.elements.type.value,
    asset: form.elements.asset.value,
    loop: form.elements.loop.checked,
    returnToState: form.elements.returnToState.value,
    message: form.elements.message.value,
    durationMs: form.elements.durationMs.value,
    weight: form.elements.weight.value
  });
  const savedConfig = await saveConfig(updateConfigAction(state.config, action), "action");

  if (savedConfig) {
    state.selectedActionId = action.id;
    render();
  }
}

function parseMessageLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function saveInteractionFromForm(form) {
  const nextInteractions = {
    clickMessages: parseMessageLines(form.elements.clickMessages.value),
    randomMessages: parseMessageLines(form.elements.randomMessages.value),
    timedMessages: parseMessageLines(form.elements.timedMessages.value),
    importSuccessMessage: form.elements.importSuccessMessage.value.trim(),
    bubble: {
      maxWidth: Number(form.elements.bubbleMaxWidth.value),
      durationMs: Number(form.elements.bubbleDurationMs.value),
      showCloseButton: form.elements.bubbleShowCloseButton.checked
    }
  };

  await saveConfig(updateConfigInteractions(state.config, nextInteractions), "interaction");
}

function readRuleConditionsFromForm(form) {
  return Array.from(form.querySelectorAll("[data-rule-condition]")).map((row) => {
    const conditionType = row.querySelector('[name="conditionType"]');
    const filterField = row.querySelector('[name="filterField"]');
    const filterOperator = row.querySelector('[name="filterOperator"]');
    const filterValue = row.querySelector('[name="filterValue"]');
    const filterUnit = row.querySelector('[name="filterUnit"]');
    const field = filterField ? filterField.value : "";

    return buildRuleConditionFromForm({
      type: conditionType ? conditionType.value : "click",
      field,
      operator: filterOperator ? filterOperator.value : "=",
      value: filterValue ? filterValue.value : "",
      unit: filterUnit ? filterUnit.value : ""
    });
  });
}

async function saveRuleFromForm(form) {
  const formValue = {
    id: form.elements.id.value,
    name: form.elements.name.value,
    enabled: form.elements.enabled.checked,
    relation: form.elements.relation.value,
    andWindowMs: form.elements.andWindowMs.value,
    cooldownMs: form.elements.cooldownMs.value,
    priority: form.elements.priority.value,
    conditions: readRuleConditionsFromForm(form),
    actionStrategy: form.elements.actionStrategy.value,
    actionIds: Array.from(form.querySelectorAll('input[name="actionIds"]:checked')).map((input) => input.value)
  };
  const errors = validateRuleForm(formValue, getActions());

  if (errors.length > 0) {
    showBanner(errors.join(" "));
    return;
  }

  const rule = buildRuleFromForm(formValue);
  const savedConfig = await saveConfig(updateConfigRule(state.config, rule), "rule");

  if (savedConfig) {
    state.selectedRuleId = rule.id;
    render();
  }
}

function updateConfigAssetBinding(config, bindingTarget, actionId, assetPath) {
  const actions = Array.isArray(config && config.customActions) ? config.customActions : [];
  if (bindingTarget !== "custom") {
    return updateConfigState(config, bindingTarget, {
      id: `${bindingTarget}-default`,
      name: BASIC_STATE_TYPES.find((stateType) => stateType.id === bindingTarget)?.name,
      asset: assetPath,
      loop: bindingTarget === "idle" || bindingTarget === "drag",
      returnToState: bindingTarget === "idle" ? undefined : "idle"
    });
  }

  return {
    ...config,
    customActions: actions.map((action) => (
      action && action.id === actionId
        ? { ...action, asset: assetPath }
        : action
    ))
  };
}

async function pickAsset() {
  if (!api || !api.assets || !api.assets.pick) {
    showBanner("Asset picker API is unavailable.");
    return;
  }

  try {
    const sourcePath = await api.assets.pick();
    if (!sourcePath) return;

    state.selectedAssetPath = sourcePath;
    state.selectedAssetResult = null;
    hideBanner();
    render();
  } catch (error) {
    showBanner(`Asset picker failed: ${error.message || error}`);
  }
}

async function importAssetFromForm(form) {
  if (!api || !api.assets || !api.assets.import) {
    showBanner("Asset import API is unavailable.");
    return;
  }

  const formData = new FormData(form);
  const sourcePath = state.selectedAssetPath;
  const packageId = String(formData.get("packageId") || "").trim();
  const bindingTarget = String(formData.get("bindingTarget") || "idle");
  const actionId = String(formData.get("actionId") || "").trim();

  state.selectedAssetPackageId = packageId;
  state.selectedAssetBindingTarget = bindingTarget;
  state.selectedAssetActionId = actionId;

  if (!sourcePath) {
    showBanner("Choose an asset file before importing.");
    return;
  }

  if (bindingTarget === "custom" && !actionId) {
    showBanner("Choose a custom action before importing.");
    return;
  }

  state.savingKey = "asset";
  render();

  try {
    const result = await api.assets.import(sourcePath, packageId);
    state.selectedAssetResult = result;

    if (!result || !result.ok) {
      showBanner((result && result.error) || "Asset import failed.");
      render();
      return;
    }

    const nextConfig = updateConfigAssetBinding(state.config, bindingTarget, actionId, result.asset);
    const savedConfig = await api.config.save(nextConfig);
    state.config = savedConfig;
    if (bindingTarget !== "custom") {
      state.selectedStateType = bindingTarget;
      state.selectedStateEntryId = `${bindingTarget}-default`;
    }
    showBanner(`Imported ${result.asset}.`, "success");
  } catch (error) {
    state.selectedAssetResult = { ok: false, error: error.message || String(error) };
    showBanner(`Asset import failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

async function deleteReferencedAsset(assetPath) {
  if (!api || !api.assets || !api.assets.delete) {
    showBanner("Asset delete API is unavailable.");
    return;
  }

  state.savingKey = "asset-delete";
  render();

  try {
    const result = await api.assets.delete(assetPath, getAssetPackageId());
    if (!result || !result.ok) {
      showBanner((result && result.error) || "Asset delete failed.");
      return;
    }

    await api.config.save(removeConfigAssetReferences(state.config, assetPath));
    state.config = await api.config.load();
    showBanner(`Deleted ${assetPath}.`, "success");
  } catch (error) {
    showBanner(`Asset delete failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

async function importPetpackFromPicker() {
  if (!api || !api.petpack || !api.petpack.import) {
    showBanner("Petpack import API is unavailable.");
    return;
  }

  state.savingKey = "petpack-import";
  state.petpackResult = null;
  render();

  try {
    const result = await api.petpack.import();
    if (!result) {
      state.petpackResult = null;
      return;
    }

    state.petpackResult = result;
    if (!result.ok) {
      showBanner(result.error || "Petpack import failed.");
      return;
    }

    if (result.packageId) {
      const savedConfig = await api.config.save({
        ...state.config,
        currentPackageId: result.packageId
      });
      state.config = savedConfig;
      state.selectedAssetPackageId = result.packageId;
    }

    showBanner(`Imported ${result.packageId}.`, "success");
  } catch (error) {
    state.petpackResult = { ok: false, error: error.message || String(error) };
    showBanner(`Petpack import failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

async function exportCurrentPetpack() {
  if (!api || !api.petpack || !api.petpack.export) {
    showBanner("Petpack export API is unavailable.");
    return;
  }

  const packageId = (state.config && state.config.currentPackageId) || "default-pet";
  state.savingKey = "petpack-export";
  state.petpackResult = null;
  render();

  try {
    const result = await api.petpack.export(packageId);
    if (!result) {
      state.petpackResult = null;
      return;
    }

    state.petpackResult = result;
    if (!result.ok) {
      showBanner(result.error || "Petpack export failed.");
      return;
    }

    showBanner(`Exported ${result.packageId}.`, "success");
  } catch (error) {
    state.petpackResult = { ok: false, error: error.message || String(error) };
    showBanner(`Petpack export failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
    render();
  }
}

tabsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  state.activeTab = button.dataset.tab;
  render();
});

rootEl.addEventListener("input", (event) => {
  if (event.target.id === "display-scale") {
    document.querySelector("#scale-value").textContent = `${event.target.value}%`;
  }
  if (event.target.id === "display-opacity") {
    document.querySelector("#opacity-value").textContent = `${event.target.value}%`;
  }
});

rootEl.addEventListener("change", async (event) => {
  if (event.target.id === "state-type") {
    state.selectedStateType = event.target.value;
    state.selectedStateEntryId = "";
    render();
    return;
  }

  if (event.target.id === "asset-binding-target") {
    state.selectedAssetBindingTarget = event.target.value;
    render();
    return;
  }

  if (event.target.id === "asset-action-id") {
    state.selectedAssetActionId = event.target.value;
    return;
  }

  if (event.target.id === "asset-package-id") {
    state.selectedAssetPackageId = event.target.value;
    return;
  }

  if (event.target.id === "launch-at-login") {
    await setLaunchAtLogin(event.target.checked);
    return;
  }

  if (event.target.dataset.role !== "condition-type") return;

  const row = event.target.closest("[data-rule-condition]");
  const fieldSelect = row && row.querySelector('[data-role="filter-field"]');
  if (!fieldSelect) return;

  const fields = getFieldsForCondition(event.target.value);
  fieldSelect.innerHTML = [`<option value="">No filter</option>`, ...fields.map((field) => {
    const inputType = FIELD_INPUT_TYPES[field] || "text";
    return `<option value="${escapeHtml(field)}">${escapeHtml(field)} (${escapeHtml(inputType)})</option>`;
  })].join("");
});

rootEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || state.savingKey) return;

  const action = button.dataset.action;
  if (action === "new-action") {
    state.selectedActionId = "";
    render();
  }
  if (action === "new-state-entry") {
    state.selectedStateEntryId = "";
    render();
  }
  if (action === "select-state") {
    state.selectedStateType = button.dataset.stateType;
    state.selectedStateEntryId = button.dataset.stateEntryId || "";
    render();
  }
  if (action === "edit-action") {
    state.selectedActionId = button.dataset.id;
    render();
  }
  if (action === "delete-action") {
    await saveConfig(deleteConfigAction(state.config, button.dataset.id), "action");
    state.selectedActionId = "";
  }
  if (action === "new-rule") {
    state.selectedRuleId = "";
    render();
  }
  if (action === "edit-rule") {
    state.selectedRuleId = button.dataset.id;
    render();
  }
  if (action === "delete-rule") {
    await saveConfig(deleteConfigRule(state.config, button.dataset.id), "rule");
    state.selectedRuleId = "";
  }
  if (action === "select-condition") {
    state.selectedConditionType = button.dataset.condition;
    render();
  }
  if (action === "add-rule-condition") {
    const list = button.closest("form").querySelector("#rule-conditions");
    const index = list.querySelectorAll("[data-rule-condition]").length;
    list.insertAdjacentHTML("beforeend", renderRuleConditionEditor({ type: "click", filters: [] }, index));
  }
  if (action === "remove-rule-condition") {
    const row = button.closest("[data-rule-condition]");
    if (row && row.parentElement.querySelectorAll("[data-rule-condition]").length > 1) {
      row.remove();
    }
  }
  if (action === "pick-asset") {
    await pickAsset();
  }
  if (action === "delete-asset") {
    await deleteReferencedAsset(button.dataset.asset);
  }
  if (action === "import-petpack") {
    await importPetpackFromPicker();
  }
  if (action === "export-petpack") {
    await exportCurrentPetpack();
  }
  if (action === "reset-position") {
    await resetPosition();
  }
  if (action === "save-system") {
    const languageSelect = document.querySelector("#language-select");
    const launchAtLoginCheckbox = document.querySelector("#launch-at-login");

    if (languageSelect) {
      const newLanguage = languageSelect.value;
      const nextConfig = updateConfigSystem(state.config, { language: newLanguage });
      await saveConfig(nextConfig, "system");

      // Update locale and re-render
      setLocale(newLanguage);
      render();
      showBanner(t("message.saved"), "success");
    }
  }
  if (action === "quit-app") {
    await api.app.quit();
  }
});

rootEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.savingKey) return;

  const form = event.target;
  const formId = form.getAttribute("id");
  let savePromise = null;

  if (formId === "display-form") {
    savePromise = saveDisplayFromForm(form);
  }
  if (formId === "state-form") {
    savePromise = saveStateFromForm(form);
  }
  if (formId === "action-form") {
    savePromise = saveActionFromForm(form);
  }
  if (formId === "interaction-form") {
    savePromise = saveInteractionFromForm(form);
  }
  if (formId === "rule-form") {
    savePromise = saveRuleFromForm(form);
  }
  if (formId === "asset-import-form") {
    savePromise = importAssetFromForm(form);
  }
  if (!savePromise) return;

  setFormSaving(form, true);

  try {
    await savePromise;
  } finally {
    if (document.contains(form)) setFormSaving(form, false);
  }
});

render();
loadConfig();
