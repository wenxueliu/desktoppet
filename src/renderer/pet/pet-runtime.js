import { evaluateRules } from "../../shared/rule-engine.js";

function getAnimations(config = {}, manifest = null) {
  return config.animations || (manifest && manifest.animations) || { default: { id: "idle", asset: "" }, clips: [] };
}

function getAssetUrl(clip, assetsByPath) {
  return clip && clip.asset && assetsByPath[clip.asset] ? assetsByPath[clip.asset] : "";
}

function isLoadableAsset(asset) {
  if (typeof asset !== "string" || asset.trim() === "") return false;
  if (asset.startsWith("/")) return true;

  try {
    const url = new URL(asset);
    return ["file:", "data:", "blob:", "http:", "https:"].includes(url.protocol);
  } catch (_error) {
    return false;
  }
}

function getFallbackAsset(clip, defaultAssets = {}) {
  if (!clip || !clip.id) return "";
  if (clip.id === "idle") return defaultAssets.idle || "";
  if (clip.id === "click") return defaultAssets.click || "";
  if (clip.id === "drag") return defaultAssets.drag || "";
  const asset = typeof clip.asset === "string" ? clip.asset : "";
  if (asset.endsWith("/idle.svg") || asset === "assets/idle.svg") return defaultAssets.idle || "";
  if (asset.endsWith("/click.svg") || asset === "assets/click.svg") return defaultAssets.click || "";
  if (asset.endsWith("/drag.svg") || asset === "assets/drag.svg") return defaultAssets.drag || "";
  return "";
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
    asset: getAssetUrl(clip, assetsByPath) ||
      (isLoadableAsset(clip && clip.asset) ? clip.asset : "") ||
      getFallbackAsset(clip, defaultAssets)
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
    },

    getRecentEvents() {
      return eventHistory.slice();
    }
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function clampProgress(value) {
  const progress = clampNumber(Number(value), 0, 1);
  return progress === null ? 0 : progress;
}

function resolveActionProgress(action, eventContext = {}) {
  const sourceField = action.progressFrom || action.progressField;
  const rawProgress = sourceField && Object.prototype.hasOwnProperty.call(eventContext, sourceField)
    ? eventContext[sourceField]
    : action.progress;
  const scale = Number.isFinite(Number(action.scale)) ? Number(action.scale) : 1;
  const offset = Number.isFinite(Number(action.offset)) ? Number(action.offset) : 0;
  return clampProgress(Number(rawProgress ?? 0) * scale + offset);
}

function isGlobalMouseEvent(eventContext = {}) {
  return eventContext && eventContext.eventSource === "globalMouse";
}

function normalizeKeyframes(keyframes) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return null;
  const lastIndex = Math.max(1, keyframes.length);
  const normalized = keyframes
    .map((keyframe, index) => {
      if (keyframe && typeof keyframe === "object" && !Array.isArray(keyframe)) {
        return {
          input: clampProgress(Number(keyframe.input ?? keyframe.position ?? (index / lastIndex))),
          output: clampProgress(Number(keyframe.output ?? keyframe.value ?? keyframe.progress ?? keyframe.input ?? (index / lastIndex)))
        };
      }
      return {
        input: clampProgress(index / lastIndex),
        output: clampProgress(Number(keyframe))
      };
    })
    .filter((keyframe) => Number.isFinite(keyframe.input) && Number.isFinite(keyframe.output))
    .sort((left, right) => left.input - right.input);
  return normalized.length > 0 ? normalized : null;
}

function interpolateWrapped(left, right, t) {
  if (right < left) {
    return (left + (1 - left + right) * t) % 1;
  }
  return left + (right - left) * t;
}

export function mapProgressThroughKeyframes(progress, keyframes) {
  const normalized = normalizeKeyframes(keyframes);
  const value = clampProgress(progress);
  if (!normalized || normalized.length === 1) return value;

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const left = normalized[index];
    const right = normalized[index + 1];
    if (value >= left.input && value <= right.input) {
      const span = right.input - left.input;
      const t = span > 0 ? (value - left.input) / span : 0;
      return clampProgress(interpolateWrapped(left.output, right.output, t));
    }
  }

  const last = normalized[normalized.length - 1];
  const first = normalized[0];
  const wrappedValue = value < first.input ? value + 1 : value;
  const wrappedFirstInput = first.input + 1;
  const span = wrappedFirstInput - last.input;
  const t = span > 0 ? (wrappedValue - last.input) / span : 0;
  return clampProgress(interpolateWrapped(last.output, first.output, t));
}

function getRandomMessage(action) {
  if (Array.isArray(action.messages) && action.messages.length > 0) {
    return action.messages[Math.floor(Math.random() * action.messages.length)];
  }
  return action.message || "";
}

export function executeRuntimeAction(action, effects, clipById, eventContext = {}) {
  if (!action || !effects) return false;

  const durationMs = Number.isFinite(action.durationMs) ? action.durationMs : undefined;

  switch (action.type) {
    case "playAnimation": {
      const animId = action.animation || action.state || action.id || "click";
      const clip = clipById ? clipById.get(animId) : null;
      const isLoopAnimation = clip && clip.type === "loop";
      const isKeyframeAnimation = clip && clip.type === "keyframe";

      // Use clip's asset URL if available, otherwise fallback to action.assetUrl
      const assetUrl = (clip && clip.asset) || action.assetUrl;
      const playOptions = { loop: Boolean(isLoopAnimation) };
      if (isKeyframeAnimation) {
        if (!isGlobalMouseEvent(eventContext)) return false;
        playOptions.keyframe = true;
        playOptions.progress = mapProgressThroughKeyframes(resolveActionProgress(action, eventContext), clip && clip.keyframes);
      }

      effects.playState(animId, assetUrl, playOptions);

      // Only schedule return to idle for non-loop animations
      if (!isLoopAnimation && !isKeyframeAnimation) {
        effects.scheduleIdle(durationMs || 900, action.returnToState);
      }
      return true;
    }
    case "setKeyframeProgress": {
      if (!isGlobalMouseEvent(eventContext)) return false;
      const animId = action.animation || action.state || action.id;
      const clip = clipById && animId ? clipById.get(animId) : null;
      const progress = mapProgressThroughKeyframes(resolveActionProgress(action, eventContext), clip && clip.keyframes);

      if (effects.setKeyframeProgress) {
        return Boolean(effects.setKeyframeProgress(animId, progress, action));
      }

      if (effects.playState && clip) {
        effects.playState(animId, clip.asset, { keyframe: true, progress });
        return true;
      }
      return false;
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
