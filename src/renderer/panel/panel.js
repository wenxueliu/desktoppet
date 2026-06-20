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
  updateConfigAction,
  updateConfigDisplay,
  updateConfigRule
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

const state = {
  activeTab: "overview",
  config: null,
  savingKey: "",
  selectedActionId: "",
  selectedRuleId: "",
  selectedConditionType: Object.keys(TRIGGER_PARAMETER_FIELDS)[0]
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
  return `
    ${renderHeader("Assets", "Asset import, petpack import, and export controls arrive in the next step.")}
    <section class="panel-section">
      <div class="section-header"><h3>Asset Tools</h3></div>
      <div class="section-body">
        <div class="form-actions">
          <button type="button" disabled>Import assets</button>
          <button type="button" disabled>Import petpack</button>
          <button type="button" disabled>Export petpack</button>
        </div>
        <p class="muted">These APIs are not available yet, so the controls are intentionally disabled.</p>
      </div>
    </section>
  `;
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
    assetPath: "",
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
              <input id="action-asset" name="assetPath" type="text" value="${escapeHtml(formAction.assetPath)}" placeholder="assets/idle.svg">
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
        <code>${escapeHtml(action.id)} · ${escapeHtml(action.type || "unknown")}${action.assetPath ? ` · ${escapeHtml(action.assetPath)}` : ""}</code>
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
    actionIds: Array.isArray(selectedRule.actions) ? selectedRule.actions.join(", ") : ""
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
    actionIds: ""
  };

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
              <input id="rule-filter-field" name="filterField" type="text" value="${escapeHtml(formRule.filterField)}" list="trigger-fields">
              ${renderTriggerFieldDatalist()}
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
              <label for="rule-actions">Action IDs</label>
              <input id="rule-actions" name="actionIds" type="text" value="${escapeHtml(formRule.actionIds)}" placeholder="action-id, another-action-id">
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

function renderTriggerFieldDatalist() {
  const fields = [...new Set(Object.values(TRIGGER_PARAMETER_FIELDS).flat())].sort();
  return `<datalist id="trigger-fields">${fields.map((field) => `<option value="${escapeHtml(field)}"></option>`).join("")}</datalist>`;
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
  render();

  try {
    state.config = await api.config.save(nextConfig);
    showBanner("Saved.", "success");
    return state.config;
  } catch (error) {
    showBanner(`Save failed: ${error.message || error}`);
    return null;
  } finally {
    state.savingKey = "";
    render();
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
  await saveConfig(nextConfig, "display");
}

async function saveActionFromForm(form) {
  const action = buildActionFromForm({
    id: form.elements.id.value,
    name: form.elements.name.value,
    type: form.elements.type.value,
    assetPath: form.elements.assetPath.value,
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
  const rule = buildRuleFromForm({
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
    actionIds: form.elements.actionIds.value
  });
  const savedConfig = await saveConfig(updateConfigRule(state.config, rule), "rule");

  if (savedConfig) {
    state.selectedRuleId = rule.id;
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

  if (event.target.id === "display-form") {
    await saveDisplayFromForm(event.target);
  }
  if (event.target.id === "action-form") {
    await saveActionFromForm(event.target);
  }
  if (event.target.id === "rule-form") {
    await saveRuleFromForm(event.target);
  }
});

render();
loadConfig();
