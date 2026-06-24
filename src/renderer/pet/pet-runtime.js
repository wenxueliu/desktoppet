import { evaluateRules } from "../../shared/rule-engine.js";

function getAnimations(config = {}, manifest = null) {
  return config.animations || (manifest && manifest.animations) || { default: { id: "idle", asset: "" }, clips: [] };
}

function getAssetUrl(clip, assetsByPath) {
  return clip && clip.asset && assetsByPath[clip.asset] ? assetsByPath[clip.asset] : "";
}

export function buildRuntimeModel({
  config = {},
  activePackage = null,
  defaultAssets
} = {}) {
  const manifest = activePackage && activePackage.manifest ? activePackage.manifest : null;
  const assetsByPath = activePackage && activePackage.assetsByPath ? activePackage.assetsByPath : {};
  const animations = getAnimations(config, manifest);
  const defaultClip = animations.default || { id: "idle", asset: "" };
  const clips = Array.isArray(animations.clips) ? animations.clips : [];
  const manifestRules = Array.isArray(manifest && manifest.triggerRules) ? manifest.triggerRules : [];
  const configRules = Array.isArray(config.triggerRules) ? config.triggerRules : [];

  const resolveClip = (clip) => ({
    ...clip,
    asset: getAssetUrl(clip, assetsByPath) || clip.asset
  });

  // Resolve asset URLs for all clips
  const resolvedDefault = resolveClip(defaultClip);
  const resolvedClips = clips.map(resolveClip);
  const clipById = new Map([resolvedDefault, ...resolvedClips].filter(Boolean).map((clip) => [clip.id, clip]));

  const clickClip = clipById.get("click");
  const dragClip = clipById.get("drag");

  return {
    config,
    activePackage,
    animationConfig: {
      default: resolvedDefault,
      clips: resolvedClips
    },
    clipById,
    spriteAssets: {
      idle: resolvedDefault.asset || defaultAssets.idle,
      click: (clickClip && clickClip.asset) || defaultAssets.click,
      drag: (dragClip && dragClip.asset) || defaultAssets.drag
    },
    rules: [...manifestRules, ...configRules]
  };
}

export function createRuleRuntime({
  rules = [],
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

      // Return actions directly from rule
      const actions = Array.isArray(rule.actions) ? rule.actions : [];
      if (rule.actionStrategy === "random" && actions.length > 0) {
        return [actions[Math.floor(Math.random() * actions.length)]];
      }
      return actions;
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

export function executeRuntimeAction(action, effects, clipById) {
  if (!action || !effects) return false;

  const durationMs = Number.isFinite(action.durationMs) ? action.durationMs : undefined;

  switch (action.type) {
    case "playAnimation": {
      const animId = action.animation || action.state || action.id || "click";
      const clip = clipById ? clipById.get(animId) : null;
      const isLoopAnimation = clip && clip.type === "loop";

      // Use clip's asset URL if available, otherwise fallback to action.assetUrl
      const assetUrl = (clip && clip.asset) || action.assetUrl;

      effects.playState(animId, assetUrl);

      // Only schedule return to idle for non-loop animations
      if (!isLoopAnimation) {
        effects.scheduleIdle(durationMs || 900, action.returnToState);
      }
      return true;
    }
    case "showMessage":
      effects.showMessage(action.text || action.message || action.name || action.id || "", durationMs || 1800);
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
