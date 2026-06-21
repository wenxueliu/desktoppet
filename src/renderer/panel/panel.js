import {
  DEFAULT_DISPLAY,
  FIELD_INPUT_TYPES,
  SUPPORTED_ACTION_TYPES,
  SUPPORTED_OPERATORS,
  SUPPORTED_RELATIONS,
  TRIGGER_PARAMETER_FIELDS,
  buildActionFromForm,
  buildRuleFromForm,
  createId,
  getFieldsForCondition,
  updateConfigAction,
  updateConfigDisplay,
  updateConfigRule,
  validateRuleForm
} from "./panel-state.js";

const TABS = [
  ["overview", "Overview"],
  ["assets", "Assets"],
  ["states", "States"],
  ["actions", "Actions"],
  ["rules", "Trigger Rules"],
  ["display", "Display"],
  ["system", "System"]
];

const IMAGE_ASSET_EXTENSIONS = [".gif", ".webp", ".png", ".svg"];
const VIDEO_ASSET_EXTENSIONS = [".webm", ".mp4", ".mov"];
const ASSET_BINDING_TARGETS = [
  ["custom", "Custom action", false],
  ["idle", "Idle state (coming soon)", true],
  ["click", "Click state (coming soon)", true],
  ["drag", "Drag state (coming soon)", true]
];

const state = {
  activeTab: "overview",
  config: null,
  savingKey: "",
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

function getAssetPackageId() {
  return state.selectedAssetPackageId || (state.config && state.config.currentPackageId) || "default-pet";
}

function renderTabs() {
  tabsEl.innerHTML = TABS.map(([id, label]) => `
    <button class="tab-button" type="button" data-tab="${id}" aria-selected="${state.activeTab === id}">
      ${escapeHtml(label)}
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
  const actions = getActions();
  const rules = getRules();

  return `
    ${renderHeader("Overview", "Current package, saved custom actions, trigger rules, and display state.")}
    <div class="metric-grid">
      <div class="metric"><span>Package</span><strong>${escapeHtml(state.config.currentPackageId || "None")}</strong></div>
      <div class="metric"><span>Actions</span><strong>${actions.length}</strong></div>
      <div class="metric"><span>Rules</span><strong>${rules.length}</strong></div>
      <div class="metric"><span>Display</span><strong>${Math.round(display.scale * 100)}%</strong></div>
    </div>
    <section class="panel-section">
      <div class="section-header"><h3>Active Display Settings</h3></div>
      <div class="section-body grid-3">
        <div class="field"><span class="field-label">Opacity</span><span>${Math.round(display.opacity * 100)}%</span></div>
        <div class="field"><span class="field-label">Always on top</span><span>${display.alwaysOnTop ? "Enabled" : "Disabled"}</span></div>
        <div class="field"><span class="field-label">Mouse passthrough</span><span>${display.mousePassthrough ? "Enabled" : "Disabled"}</span></div>
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

  return `
    ${renderHeader("Assets", "Import supported media and bind it to a state or custom action.")}
    <section class="panel-section">
      <div class="section-header"><h3>Asset Import</h3></div>
      <div class="section-body">
        <form id="asset-import-form">
          <div class="asset-grid">
            <div class="asset-preview">
              ${renderAssetPreview(sourcePath, ext)}
            </div>
            <div class="asset-controls">
              <div class="form-actions flush">
                <button type="button" data-action="pick-asset">Choose file</button>
                <button class="button-primary" type="submit" ${sourcePath && selectedActionId ? "" : "disabled"} ${disabled("asset")}>${state.savingKey === "asset" ? "Importing..." : "Import and bind"}</button>
              </div>
              <div class="field">
                <span class="field-label">Selected file</span>
                ${sourcePath ? `
                  <strong>${escapeHtml(sourceName)}</strong>
                  <code class="code-line breakable">${escapeHtml(sourcePath)}</code>
                ` : `<span class="muted">No file selected.</span>`}
              </div>
              <div class="grid-2">
                <div class="field">
                  <label for="asset-package-id">Package</label>
                  <input id="asset-package-id" name="packageId" type="text" value="${escapeHtml(getAssetPackageId())}">
                </div>
                <div class="field">
                  <label for="asset-binding-target">Bind to</label>
                  <select id="asset-binding-target" name="bindingTarget">
                    ${ASSET_BINDING_TARGETS.map(([value, label, isDisabled]) => `<option value="${escapeHtml(value)}" ${selected(state.selectedAssetBindingTarget, value)} ${isDisabled ? "disabled" : ""}>${escapeHtml(label)}</option>`).join("")}
                  </select>
                </div>
                <div class="field">
                  <label for="asset-action-id">Custom action</label>
                  <select id="asset-action-id" name="actionId">
                    ${actions.length
    ? actions.map((action) => `<option value="${escapeHtml(action.id)}" ${selected(selectedActionId, action.id)}>${escapeHtml(action.name || action.id)}</option>`).join("")
    : `<option value="">No custom actions</option>`}
                  </select>
                  <small>State bindings will be enabled after the package runtime model lands.</small>
                </div>
              </div>
              ${result ? renderAssetResult(result) : ""}
            </div>
          </div>
        </form>
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>Petpack</h3></div>
      <div class="section-body">
        <div class="form-actions flush">
          <button type="button" data-action="import-petpack" ${disabled("petpack-import")}>${state.savingKey === "petpack-import" ? "Importing..." : "Import petpack"}</button>
          <button type="button" data-action="export-petpack" ${disabled("petpack-export")}>${state.savingKey === "petpack-export" ? "Exporting..." : "Export petpack"}</button>
        </div>
        <p class="muted">Current package: ${escapeHtml(currentPackageId)}</p>
        ${petpackResult ? renderPetpackResult(petpackResult) : ""}
      </div>
    </section>
  `;
}

function renderAssetPreview(sourcePath, ext) {
  if (!sourcePath) {
    return `<div class="empty-state compact">Preview</div>`;
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
  return `
    ${renderHeader("States", "State editing will be connected after asset and petpack APIs are available.")}
    <section class="panel-section">
      <div class="section-header"><h3>Package States</h3></div>
      <div class="section-body">
        <div class="empty-state">State browser and state editor are coming in the next step.</div>
      </div>
    </section>
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
    ${renderHeader("Actions", "Create or edit custom actions saved under config.customActions.", `
      <button type="button" data-action="new-action">New action</button>
    `)}
    <section class="panel-section">
      <div class="section-header"><h3>Custom Actions</h3><span class="muted">${actions.length} saved</span></div>
      <div class="section-body">
        ${actions.length ? `<div class="item-list">${actions.map(renderActionRow).join("")}</div>` : `<div class="empty-state">No custom actions yet.</div>`}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${selectedAction ? "Edit Action" : "Create Action"}</h3></div>
      <div class="section-body">
        <form id="action-form">
          <input type="hidden" name="id" value="${escapeHtml(formAction.id)}">
          <div class="grid-2">
            <div class="field">
              <label for="action-name">Name</label>
              <input id="action-name" name="name" type="text" value="${escapeHtml(formAction.name)}" required>
            </div>
            <div class="field">
              <label for="action-type">Type</label>
              <select id="action-type" name="type">
                ${SUPPORTED_ACTION_TYPES.map((type) => `<option value="${escapeHtml(type)}" ${selected(formAction.type, type)}>${escapeHtml(type)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="action-asset">Asset path</label>
              <input id="action-asset" name="asset" type="text" value="${escapeHtml(getActionAsset(formAction))}" placeholder="assets/idle.svg">
            </div>
            <div class="field">
              <label for="action-return-state">Return to state</label>
              <input id="action-return-state" name="returnToState" type="text" value="${escapeHtml(formAction.returnToState)}" placeholder="idle">
            </div>
            <label class="toggle">
              <span>Loop</span>
              <input name="loop" type="checkbox" ${checked(formAction.loop)}>
            </label>
            <div class="field">
              <label for="action-weight">Weight</label>
              <input id="action-weight" name="weight" type="number" min="0" step="1" value="${escapeHtml(formAction.weight ?? "")}">
            </div>
            <div class="field">
              <label for="action-duration">Duration ms</label>
              <input id="action-duration" name="durationMs" type="number" min="0" step="50" value="${escapeHtml(formAction.durationMs ?? "")}">
            </div>
            <div class="field">
              <label for="action-message">Message</label>
              <textarea id="action-message" name="message">${escapeHtml(formAction.message)}</textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="button-primary" type="submit" ${disabled("action")}>${state.savingKey === "action" ? "Saving..." : "Save action"}</button>
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
        <strong>${escapeHtml(action.name || "Untitled action")}</strong>
        <code>${escapeHtml(action.id)} · ${escapeHtml(action.type || "unknown")}${getActionAsset(action) ? ` · ${escapeHtml(getActionAsset(action))}` : ""}</code>
      </div>
      <button type="button" data-action="edit-action" data-id="${escapeHtml(action.id)}">Edit</button>
    </div>
  `;
}

function renderRules() {
  const rules = getRules();
  const selectedRule = rules.find((rule) => rule.id === state.selectedRuleId) || null;
  const firstCondition = selectedRule && Array.isArray(selectedRule.conditions) ? selectedRule.conditions[0] : null;
  const firstFilter = firstCondition && Array.isArray(firstCondition.filters) ? firstCondition.filters[0] : null;
  const formRule = selectedRule ? {
    id: selectedRule.id,
    name: selectedRule.name,
    enabled: selectedRule.enabled !== false,
    relation: selectedRule.relation || "single",
    windowMs: selectedRule.windowMs ?? "",
    cooldownMs: selectedRule.cooldownMs ?? 0,
    priority: selectedRule.priority ?? 0,
    conditionType: firstCondition ? firstCondition.type : "click",
    filterField: firstFilter ? firstFilter.field : "isInsidePet",
    filterOperator: firstFilter ? firstFilter.operator : "=",
    filterValue: Array.isArray(firstFilter && firstFilter.value) ? firstFilter.value.join(", ") : (firstFilter ? firstFilter.value : "true"),
    filterUnit: firstFilter ? firstFilter.unit : "",
    actionStrategy: selectedRule.actionStrategy || "sequence",
    actionIds: Array.isArray(selectedRule.actions) ? selectedRule.actions : []
  } : {
    id: createId("rule"),
    name: "",
    enabled: true,
    relation: "single",
    windowMs: 3000,
    cooldownMs: 0,
    priority: 0,
    conditionType: "click",
    filterField: "isInsidePet",
    filterOperator: "=",
    filterValue: "true",
    filterUnit: "",
    actionStrategy: "sequence",
    actionIds: []
  };
  const supportedFields = getFieldsForCondition(formRule.conditionType);
  const filterField = supportedFields.includes(formRule.filterField) ? formRule.filterField : (supportedFields[0] || "");

  return `
    ${renderHeader("Trigger Rules", "Browse built-in trigger conditions and create rules saved under config.triggerRules.", `
      <button type="button" data-action="new-rule">New rule</button>
    `)}
    ${renderConditionBrowser()}
    <section class="panel-section">
      <div class="section-header"><h3>Saved Rules</h3><span class="muted">${rules.length} saved</span></div>
      <div class="section-body">
        ${rules.length ? `<div class="item-list">${rules.map(renderRuleRow).join("")}</div>` : `<div class="empty-state">No trigger rules yet.</div>`}
      </div>
    </section>
    <section class="panel-section">
      <div class="section-header"><h3>${selectedRule ? "Edit Rule" : "Create Rule"}</h3></div>
      <div class="section-body">
        <form id="rule-form">
          <input type="hidden" name="id" value="${escapeHtml(formRule.id)}">
          <div class="grid-3">
            <div class="field">
              <label for="rule-name">Name</label>
              <input id="rule-name" name="name" type="text" value="${escapeHtml(formRule.name)}" required>
            </div>
            <label class="toggle">
              <span>Enabled</span>
              <input name="enabled" type="checkbox" ${checked(formRule.enabled)}>
            </label>
            <div class="field">
              <label for="rule-relation">Relation</label>
              <select id="rule-relation" name="relation">
                ${SUPPORTED_RELATIONS.map((relation) => `<option value="${escapeHtml(relation)}" ${selected(formRule.relation, relation)}>${escapeHtml(relation)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="rule-window">AND window ms</label>
              <input id="rule-window" name="windowMs" type="number" min="0" step="100" value="${escapeHtml(formRule.windowMs)}">
            </div>
            <div class="field">
              <label for="rule-cooldown">Cooldown ms</label>
              <input id="rule-cooldown" name="cooldownMs" type="number" min="0" step="100" value="${escapeHtml(formRule.cooldownMs)}">
            </div>
            <div class="field">
              <label for="rule-priority">Priority</label>
              <input id="rule-priority" name="priority" type="number" step="1" value="${escapeHtml(formRule.priority)}">
            </div>
            <div class="field">
              <label for="rule-condition-type">Condition type</label>
              <select id="rule-condition-type" name="conditionType">
                ${Object.keys(TRIGGER_PARAMETER_FIELDS).map((type) => `<option value="${escapeHtml(type)}" ${selected(formRule.conditionType, type)}>${escapeHtml(type)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="rule-filter-field">Filter field</label>
              <select id="rule-filter-field" name="filterField">
                ${supportedFields.map((field) => `<option value="${escapeHtml(field)}" ${selected(filterField, field)}>${escapeHtml(field)} (${escapeHtml(FIELD_INPUT_TYPES[field] || "text")})</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="rule-filter-operator">Operator</label>
              <select id="rule-filter-operator" name="filterOperator">
                ${SUPPORTED_OPERATORS.map((operator) => `<option value="${escapeHtml(operator)}" ${selected(formRule.filterOperator, operator)}>${escapeHtml(operator)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="rule-filter-value">Filter value</label>
              <input id="rule-filter-value" name="filterValue" type="text" value="${escapeHtml(formRule.filterValue)}">
              <small>Use comma-separated values for between, in, and notIn.</small>
            </div>
            <div class="field">
              <label for="rule-filter-unit">Unit</label>
              <input id="rule-filter-unit" name="filterUnit" type="text" value="${escapeHtml(formRule.filterUnit)}" placeholder="px, px/s, ms">
            </div>
            <div class="field">
              <label for="rule-action-strategy">Action strategy</label>
              <select id="rule-action-strategy" name="actionStrategy">
                <option value="sequence" ${selected(formRule.actionStrategy, "sequence")}>sequence</option>
                <option value="random" ${selected(formRule.actionStrategy, "random")}>random</option>
              </select>
            </div>
            <div class="field">
              <span class="field-label">Actions</span>
              ${renderRuleActionSelector(formRule.actionIds)}
            </div>
          </div>
          <div class="form-actions">
            <button class="button-primary" type="submit" ${disabled("rule")}>${state.savingKey === "rule" ? "Saving..." : "Save rule"}</button>
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
      <button type="button" data-action="edit-rule" data-id="${escapeHtml(rule.id)}">Edit</button>
    </div>
  `;
}

function renderRuleActionSelector(selectedActionIds) {
  const actions = getActions();
  const selectedIds = new Set(selectedActionIds);

  if (actions.length === 0) {
    return `<div class="empty-state compact">Create a custom action before saving a rule.</div>`;
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
    ${renderHeader("Display", "Adjust panel-saved display preferences and apply live pet window flags.")}
    <section class="panel-section">
      <div class="section-header"><h3>Display Settings</h3></div>
      <div class="section-body">
        <form id="display-form">
          <div class="grid-2">
            <div class="field">
              <label for="display-scale">Scale <span id="scale-value">${Math.round(display.scale * 100)}%</span></label>
              <input id="display-scale" name="scale" type="range" min="50" max="150" step="1" value="${Math.round(display.scale * 100)}">
            </div>
            <div class="field">
              <label for="display-opacity">Opacity <span id="opacity-value">${Math.round(display.opacity * 100)}%</span></label>
              <input id="display-opacity" name="opacity" type="range" min="50" max="100" step="1" value="${Math.round(display.opacity * 100)}">
            </div>
            <label class="toggle">
              <span>Always on top</span>
              <input name="alwaysOnTop" type="checkbox" ${checked(display.alwaysOnTop)}>
            </label>
            <label class="toggle">
              <span>Mouse passthrough</span>
              <input name="mousePassthrough" type="checkbox" ${checked(display.mousePassthrough)}>
            </label>
            <label class="toggle">
              <span>Show hover buttons</span>
              <input name="showHoverButtons" type="checkbox" ${checked(display.showHoverButtons)}>
            </label>
          </div>
          <div class="form-actions">
            <button class="button-primary" type="submit" ${disabled("display")}>${state.savingKey === "display" ? "Saving..." : "Save display"}</button>
            <button type="button" data-action="reset-position" ${disabled("display")}>Reset position</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderSystem() {
  const configPath = state.config.configPath || (state.config.system && state.config.system.configPath) || "";

  return `
    ${renderHeader("System", "Application-level controls exposed by the panel preload.")}
    <section class="panel-section">
      <div class="section-header"><h3>App</h3></div>
      <div class="section-body">
        ${configPath ? `<p class="code-line">${escapeHtml(configPath)}</p>` : `<p class="muted">Config path is not available from the current preload response.</p>`}
        <label class="toggle">
          <span>Launch at login</span>
          <input id="launch-at-login" type="checkbox" ${checked(state.systemLaunchAtLogin)} ${disabled("system")}>
        </label>
        <div class="form-actions">
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
      state.config = {
        ...state.config,
        system: {
          ...(state.config.system || {}),
          launchAtLogin: state.systemLaunchAtLogin
        }
      };
    }
    showBanner("Saved.", "success");
  } catch (error) {
    showBanner(`Startup setting failed: ${error.message || error}`);
  } finally {
    state.savingKey = "";
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

async function saveRuleFromForm(form) {
  const formValue = {
    id: form.elements.id.value,
    name: form.elements.name.value,
    enabled: form.elements.enabled.checked,
    relation: form.elements.relation.value,
    windowMs: form.elements.windowMs.value,
    cooldownMs: form.elements.cooldownMs.value,
    priority: form.elements.priority.value,
    conditionType: form.elements.conditionType.value,
    filterField: form.elements.filterField.value,
    filterOperator: form.elements.filterOperator.value,
    filterValue: form.elements.filterValue.value,
    filterUnit: form.elements.filterUnit.value,
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
  return {
    ...config,
    customActions: actions.map((action) => (
      action && action.id === actionId && bindingTarget === "custom"
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

  if (bindingTarget !== "custom") {
    showBanner("State asset bindings are coming soon. Choose a custom action.");
    return;
  }

  if (!actionId) {
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
    showBanner(`Imported ${result.asset}.`, "success");
  } catch (error) {
    state.selectedAssetResult = { ok: false, error: error.message || String(error) };
    showBanner(`Asset import failed: ${error.message || error}`);
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

  if (event.target.id !== "rule-condition-type") return;

  const form = event.target.form;
  const fieldSelect = form && form.elements.filterField;
  if (!fieldSelect) return;

  const fields = getFieldsForCondition(event.target.value);
  fieldSelect.innerHTML = fields.map((field) => {
    const inputType = FIELD_INPUT_TYPES[field] || "text";
    return `<option value="${escapeHtml(field)}">${escapeHtml(field)} (${escapeHtml(inputType)})</option>`;
  }).join("");
});

rootEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || state.savingKey) return;

  const action = button.dataset.action;
  if (action === "new-action") {
    state.selectedActionId = "";
    render();
  }
  if (action === "edit-action") {
    state.selectedActionId = button.dataset.id;
    render();
  }
  if (action === "new-rule") {
    state.selectedRuleId = "";
    render();
  }
  if (action === "edit-rule") {
    state.selectedRuleId = button.dataset.id;
    render();
  }
  if (action === "select-condition") {
    state.selectedConditionType = button.dataset.condition;
    render();
  }
  if (action === "pick-asset") {
    await pickAsset();
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
  if (formId === "action-form") {
    savePromise = saveActionFromForm(form);
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
