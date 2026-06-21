import { evaluateRules } from "../../shared/rule-engine.js";

function selectActions(rule, actionsById) {
  const actionIds = Array.isArray(rule && rule.actions) ? rule.actions : [];
  const actions = actionIds.map((actionId) => actionsById[actionId]).filter(Boolean);

  if (rule && rule.actionStrategy === "random") {
    if (actions.length === 0) return [];
    return [actions[Math.floor(Math.random() * actions.length)]];
  }

  return actions;
}

function firstAssetUrlForState(states, assetsByPath, stateName) {
  const entries = Array.isArray(states && states[stateName]) ? states[stateName] : [];
  const entry = entries.find((candidate) => candidate && candidate.asset && assetsByPath[candidate.asset]);
  return entry ? assetsByPath[entry.asset] : "";
}

function mergeStateEntries(packageStates = {}, configStates = {}) {
  const stateNames = new Set([
    ...Object.keys(packageStates || {}),
    ...Object.keys(configStates || {})
  ]);

  return Object.fromEntries([...stateNames].map((stateName) => {
    const configuredEntries = Array.isArray(configStates && configStates[stateName]) ? configStates[stateName] : [];
    const packageEntries = Array.isArray(packageStates && packageStates[stateName]) ? packageStates[stateName] : [];
    return [stateName, [...configuredEntries, ...packageEntries]];
  }));
}

function withAssetUrl(action, assetsByPath) {
  if (!action || typeof action !== "object") return null;
  const asset = action.asset || action.assetPath;
  const { assetUrl: _assetUrl, ...safeAction } = action;
  if (asset && assetsByPath[asset]) {
    safeAction.assetUrl = assetsByPath[asset];
  }
  return safeAction;
}

function indexActions(actions, assetsByPath) {
  return actions.reduce((indexed, action) => {
    const nextAction = withAssetUrl(action, assetsByPath);
    if (nextAction && nextAction.id) {
      indexed[nextAction.id] = nextAction;
    }
    return indexed;
  }, {});
}

function applyInteractionDefaults(actionsById, interactions = {}) {
  const bubble = interactions && interactions.bubble && typeof interactions.bubble === "object" ? interactions.bubble : {};
  const durationMs = Number.isFinite(Number(bubble.durationMs)) ? Number(bubble.durationMs) : undefined;

  function patchMessages(actionId, messages) {
    if (!actionsById[actionId] || !Array.isArray(messages) || messages.length === 0) return;
    actionsById[actionId] = {
      ...actionsById[actionId],
      messages,
      ...(durationMs ? { durationMs } : {})
    };
  }

  patchMessages("default-random-click-message", interactions.clickMessages);
  patchMessages("default-random-message", interactions.randomMessages);
  patchMessages("default-timed-message", interactions.timedMessages);
}

export function buildRuntimeModel({
  config = {},
  activePackage = null,
  defaultAssets
} = {}) {
  const manifest = activePackage && activePackage.manifest ? activePackage.manifest : null;
  const assetsByPath = activePackage && activePackage.assetsByPath ? activePackage.assetsByPath : {};
  const states = mergeStateEntries(
    manifest && manifest.states ? manifest.states : {},
    config && config.states ? config.states : {}
  );
  const customActions = Array.isArray(config.customActions) ? config.customActions : [];
  const manifestActions = Array.isArray(manifest && manifest.actions) ? manifest.actions : [];
  const manifestRules = Array.isArray(manifest && manifest.triggers) ? manifest.triggers : [];
  const configRules = Array.isArray(config.triggerRules) ? config.triggerRules : [];

  const actionsById = {
    ...indexActions(manifestActions, assetsByPath),
    ...indexActions(customActions, assetsByPath)
  };
  applyInteractionDefaults(actionsById, config.interactions || {});

  return {
    config,
    activePackage,
    spriteAssets: {
      idle: firstAssetUrlForState(states, assetsByPath, "idle") || defaultAssets.idle,
      click: firstAssetUrlForState(states, assetsByPath, "click") || defaultAssets.click,
      drag: firstAssetUrlForState(states, assetsByPath, "drag") || defaultAssets.drag
    },
    actionsById,
    rules: [...manifestRules, ...configRules]
  };
}

export function createRuleRuntime({
  rules = [],
  actionsById = {},
  maxHistory = 40,
  now = Date.now
} = {}) {
  const eventHistory = [];
  const lastTriggeredAtByRuleId = {};

  return {
    evaluateEvent(event) {
      const timestamp = typeof event.timestamp === "number" ? event.timestamp : now();
      const nextEvent = { ...event, timestamp };
      eventHistory.push(nextEvent);
      if (eventHistory.length > maxHistory) {
        eventHistory.splice(0, eventHistory.length - maxHistory);
      }

      const matchedRules = evaluateRules({
        rules,
        eventHistory,
        now: timestamp,
        lastTriggeredAtByRuleId
      });
      const rule = matchedRules[0];
      if (!rule) return [];

      lastTriggeredAtByRuleId[rule.id] = timestamp;
      return selectActions(rule, actionsById);
    },

    getLastTriggeredAtByRuleId() {
      return { ...lastTriggeredAtByRuleId };
    }
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function getRandomMessage(action) {
  if (Array.isArray(action.messages) && action.messages.length > 0) {
    return action.messages[Math.floor(Math.random() * action.messages.length)];
  }
  return action.message || "";
}

export function executeRuntimeAction(action, effects) {
  if (!action || !effects) return false;

  const durationMs = Number.isFinite(action.durationMs) ? action.durationMs : undefined;

  switch (action.type) {
    case "playAnimation":
      effects.playState(action.state || action.id || "click", action.assetUrl);
      effects.scheduleIdle(durationMs || 900, action.returnToState);
      return true;
    case "switchState":
      effects.playState(action.state || action.returnToState || "idle", action.assetUrl);
      return true;
    case "showMessage":
      effects.showMessage(action.message || action.name || action.id || "", durationMs || 1800);
      return true;
    case "randomMessage":
      effects.showMessage(getRandomMessage(action), durationMs || 1800);
      return true;
    case "changeScale": {
      const scale = clampNumber(Number(action.scale ?? action.value), 0.25, 4);
      if (scale !== null) effects.applyDisplayPatch({ scale });
      return scale !== null;
    }
    case "changeOpacity": {
      const opacity = clampNumber(Number(action.opacity ?? action.value), 0, 1);
      if (opacity !== null) effects.applyDisplayPatch({ opacity });
      return opacity !== null;
    }
    case "hidePet":
      effects.setHidden(true);
      return true;
    case "showPet":
      effects.setHidden(false);
      return true;
    case "resetPosition":
      effects.resetPosition();
      return true;
    case "openPanel":
      effects.openPanel();
      return true;
    default:
      return false;
  }
}
