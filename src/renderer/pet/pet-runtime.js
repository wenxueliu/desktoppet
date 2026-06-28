import { evaluateRules, eventMatchesRule } from "../../shared/rule-engine.js";
import { createDebugLogger } from "./debug-utils.js";

const debugRulesLog = createDebugLogger("[desktop-pet:rules]");

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

function mergeRulesById(manifestRules, configRules) {
  const merged = new Map();
  [...manifestRules, ...configRules].forEach((rule, index) => {
    if (!rule || typeof rule !== "object") return;
    const key = rule.id || `__index_${index}`;
    merged.set(key, rule);
  });
  return [...merged.values()];
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
    rules: mergeRulesById(manifestRules, configRules)
  };
}


export function createRuleRuntime({
  rules = [],
  maxHistory = 40,
  now = Date.now,
  onTimerActions = null
} = {}) {
  const eventHistory = [];
  const lastTriggeredAtByRuleId = {};

  // Per-rule state for stateful (sustained) rules.
  // ruleId -> { conditionTrueSince: number|null, active: boolean, exitTrueSince: number|null }
  const ruleState = {};
  // Pending exit actions to flush before the next event returns actions.
  let pendingExitActions = [];
  let exitTimer = null;
  const EXIT_CHECK_INTERVAL_MS = 500;

  function getMouseMoveCondition(rule) {
    if (!rule || !Array.isArray(rule.conditions)) return null;
    return rule.conditions.find((condition) => condition && condition.type === "mouseMove") || null;
  }

  function hasExitState(rule) {
    const state = rule && rule.state ? rule.state : null;
    return Boolean(state && (
      (Array.isArray(state.exitConditions) && state.exitConditions.length > 0) ||
      (Array.isArray(state.exitActions) && state.exitActions.length > 0) ||
      Number(state.exitAfterMs) > 0
    ));
  }

  function isStatefulRule(rule) {
    const condition = getMouseMoveCondition(rule);
    if (!condition) return false;
    const sustainMs = Number(condition.sustainMs);
    return (Number.isFinite(sustainMs) && sustainMs > 0) || hasExitState(rule);
  }

  function buildExitRule(rule) {
    const state = rule && rule.state ? rule.state : null;
    if (!state || !Array.isArray(state.exitConditions) || state.exitConditions.length === 0) {
      return null;
    }
    return {
      relation: state.exitRelation || "single",
      andWindowMs: state.exitAndWindowMs,
      conditions: state.exitConditions
    };
  }

  function getExitSustainMs(rule) {
    const exitRule = buildExitRule(rule);
    if (!exitRule) {
      const fallback = Number(rule && rule.state && rule.state.exitAfterMs);
      return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
    }
    const condition = exitRule.conditions.find((item) => {
      const sustainMs = Number(item && item.sustainMs);
      return item && item.type === "mouseMove" && Number.isFinite(sustainMs) && sustainMs > 0;
    });
    const sustainMs = Number(condition && condition.sustainMs);
    return Number.isFinite(sustainMs) && sustainMs > 0 ? sustainMs : 0;
  }

  function getState(ruleId) {
    if (!ruleState[ruleId]) {
      ruleState[ruleId] = { conditionTrueSince: null, active: false, exitTrueSince: null, lastMatchingEvent: null, lastExitEvent: null };
    }
    return ruleState[ruleId];
  }

  function defaultExitActions() {
    return [{ type: "stopAnimation" }];
  }

  function resolveExitActions(rule) {
    const exitActions = rule && rule.state && Array.isArray(rule.state.exitActions) && rule.state.exitActions.length > 0
      ? rule.state.exitActions
      : defaultExitActions();
    return exitActions.map((action) => ({ ...action }));
  }

  // Background timer ensures enter/exit timeouts fire even when the cursor is
  // still (the global mouse tracker does not emit mouseMove when the position is
  // unchanged). It is armed while any stateful rule is active or waiting for its
  // enter sustain threshold.
  function ensureExitTimer() {
    const anyPending = Object.keys(ruleState).some((id) => {
      const state = ruleState[id];
      return state && (state.active || state.conditionTrueSince !== null);
    });
    if (anyPending && !exitTimer) {
      exitTimer = setInterval(tickStateChecks, EXIT_CHECK_INTERVAL_MS);
    } else if (!anyPending && exitTimer) {
      clearInterval(exitTimer);
      exitTimer = null;
    }
  }

  function tickStateChecks() {
    const currentNow = now();
    for (const rule of rules) {
      if (!isStatefulRule(rule)) continue;
      const state = getState(rule.id);

      if (!state.active && state.conditionTrueSince !== null && state.lastMatchingEvent) {
        const sustainedCondition = getMouseMoveCondition(rule);
        const sustainMs = Number(sustainedCondition && sustainedCondition.sustainMs);
        const threshold = Number.isFinite(sustainMs) && sustainMs > 0 ? sustainMs : 0;
        if (currentNow - state.conditionTrueSince >= threshold) {
          debugRulesLog("timer-enter", {
            ruleId: rule.id,
            ruleName: rule.name,
            since: state.conditionTrueSince,
            now: currentNow,
            threshold,
            lastEvent: state.lastMatchingEvent
          });
          enterRule(rule, currentNow, state.lastMatchingEvent, true);
        }
      }

      if (!state.active) continue;
      const exitAfterMs = getExitSustainMs(rule);
      if (!Number.isFinite(exitAfterMs) || exitAfterMs <= 0) continue;
      if (state.exitTrueSince !== null && currentNow - state.exitTrueSince >= exitAfterMs) {
        debugRulesLog("timer-exit", {
          ruleId: rule.id,
          ruleName: rule.name,
          since: state.exitTrueSince,
          now: currentNow,
          threshold: exitAfterMs,
          lastEvent: state.lastExitEvent
        });
        flushExit(rule, currentNow);
      }
    }
    ensureExitTimer();
  }

  function dispatchTimerActions(actions, eventContext) {
    if (typeof onTimerActions === "function") {
      onTimerActions(actions, eventContext);
      return true;
    }
    return false;
  }

  function enterRule(rule, timestamp, eventContext, dispatchImmediately = false) {
    const state = getState(rule.id);
    if (state.active) return [];
    state.active = true;
    state.exitTrueSince = null;
    lastTriggeredAtByRuleId[rule.id] = timestamp;
    const actions = collectRuleActions(rule);
    debugRulesLog("enter", {
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp,
      dispatchImmediately,
      eventSource: eventContext && eventContext.eventSource,
      distanceToPetCenter: eventContext && eventContext.distanceToPetCenter,
      angleToPetProgress: eventContext && eventContext.angleToPetProgress,
      actions
    });
    if (dispatchImmediately) {
      dispatchTimerActions(actions, {
        ...eventContext,
        timestamp,
        stateTransition: "enter",
        ruleId: rule.id
      });
      return [];
    }
    return actions;
  }


  function flushExit(rule, timestamp) {
    const state = getState(rule.id);
    if (!state.active) return;
    const eventContext = state.lastExitEvent
      ? { ...state.lastExitEvent, timestamp, stateTransition: "exit", ruleId: rule.id }
      : { type: "stateExit", ruleId: rule.id, timestamp, eventSource: "ruleRuntime" };
    state.active = false;
    state.conditionTrueSince = null;
    state.exitTrueSince = null;
    state.lastMatchingEvent = null;
    state.lastExitEvent = null;
    lastTriggeredAtByRuleId[rule.id] = timestamp;
    const exitActions = resolveExitActions(rule);
    debugRulesLog("exit", {
      ruleId: rule.id,
      ruleName: rule.name,
      timestamp,
      eventSource: eventContext && eventContext.eventSource,
      distanceToPetCenter: eventContext && eventContext.distanceToPetCenter,
      actions: exitActions
    });
    if (dispatchTimerActions(exitActions, eventContext || { type: "stateExit", ruleId: rule.id, timestamp: now(), eventSource: "ruleRuntime" })) {
      return;
    }
    pendingExitActions.push(...exitActions);
  }

  function collectRuleActions(rule) {
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    if (rule.actionStrategy === "random" && actions.length > 0) {
      return [actions[Math.floor(Math.random() * actions.length)]];
    }
    return actions.map((action) => ({ ...action }));
  }

  function ruleRequiresGlobalMouse(rule) {
    const actions = Array.isArray(rule && rule.actions) ? rule.actions : [];
    return actions.some((action) => action && (
      action.type === "setKeyframeProgress" ||
      action.progressFrom === "angleToPetProgress" ||
      action.progressField === "angleToPetProgress"
    ));
  }

  function shouldEvaluateRuleForEvent(rule, event) {
    if (!ruleRequiresGlobalMouse(rule)) return true;
    if (!event || event.type !== "mouseMove") return true;
    return event.eventSource === "globalMouse";
  }

  function getRuleConditions(rule) {
    if (Array.isArray(rule && rule.conditions)) return rule.conditions;
    if (rule && rule.trigger) return [{ type: rule.trigger, filters: rule.filters || [] }];
    return [];
  }

  function eventMatchesAnyConditionType(rule, event) {
    if (!event || !event.type) return false;
    return getRuleConditions(rule).some((condition) => condition && condition.type === event.type);
  }

  // Advance stateful rules against the current event. Returns enter actions
  // for any rule that just became active this tick.
  function advanceStatefulRules(currentEvent, timestamp) {
    const justEntered = [];
    for (const rule of rules) {
      if (!isStatefulRule(rule)) continue;
      if (!shouldEvaluateRuleForEvent(rule, currentEvent)) {
        debugRulesLog("skip-event-source", {
          ruleId: rule.id,
          ruleName: rule.name,
          eventType: currentEvent && currentEvent.type,
          eventSource: currentEvent && currentEvent.eventSource
        });
        continue;
      }
      const state = getState(rule.id);
      const enterEventRelevant = eventMatchesAnyConditionType(rule, currentEvent);
      const matches = enterEventRelevant ? eventMatchesRule(rule, currentEvent, eventHistory, timestamp) : false;
      debugRulesLog("stateful-check", {
        ruleId: rule.id,
        ruleName: rule.name,
        eventType: currentEvent && currentEvent.type,
        eventSource: currentEvent && currentEvent.eventSource,
        distanceToPetCenter: currentEvent && currentEvent.distanceToPetCenter,
        distanceToPetBounds: currentEvent && currentEvent.distanceToPetBounds,
        angleToPetProgress: currentEvent && currentEvent.angleToPetProgress,
        enterEventRelevant,
        matches,
        active: state.active,
        conditionTrueSince: state.conditionTrueSince,
        exitTrueSince: state.exitTrueSince
      });

      if (matches) {
        if (state.conditionTrueSince === null) {
          state.conditionTrueSince = timestamp;
        }
        state.lastMatchingEvent = currentEvent;
        const sustainedCondition = getMouseMoveCondition(rule);
        const sustainMs = Number(sustainedCondition && sustainedCondition.sustainMs);
        const threshold = Number.isFinite(sustainMs) && sustainMs > 0 ? sustainMs : 0;
        if (!state.active && timestamp - state.conditionTrueSince >= threshold) {
          justEntered.push(...enterRule(rule, timestamp, currentEvent));
        } else if (state.active && rule.continuous === true) {
          // Continuous stateful rules (e.g. keyframe scrubbing driven by mouse
          // angle) re-emit their actions on every matching event so the output
          // follows the cursor, while still honoring exit conditions to leave
          // the state. Sustained rules (enter sustainMs > 0) fire only once.
          justEntered.push(...collectRuleActions(rule));
        }
      } else if (enterEventRelevant) {
        state.conditionTrueSince = null;
        state.lastMatchingEvent = null;
      }

      if (state.active) {
        const exitRule = buildExitRule(rule);
        const exitEventRelevant = exitRule ? eventMatchesAnyConditionType(exitRule, currentEvent) : enterEventRelevant;
        const exitMatches = exitEventRelevant
          ? (exitRule ? eventMatchesRule(exitRule, currentEvent, eventHistory, timestamp) : !matches)
          : false;
        if (exitEventRelevant && exitMatches) {
          if (state.exitTrueSince === null) {
            state.exitTrueSince = timestamp;
          }
          state.lastExitEvent = currentEvent;
        } else if (exitEventRelevant) {
          state.exitTrueSince = null;
          state.lastExitEvent = null;
        }

        const exitAfterMs = getExitSustainMs(rule);
        if (Number.isFinite(exitAfterMs) && exitAfterMs > 0
          && state.exitTrueSince !== null
          && timestamp - state.exitTrueSince >= exitAfterMs) {
          flushExit(rule, timestamp);
        }
      }
    }
    return justEntered;
  }

  return {
    evaluateEvent(event) {
      const timestamp = typeof event.timestamp === "number" ? event.timestamp : now();
      const nextEvent = { ...event, timestamp };
      eventHistory.push(nextEvent);
      if (eventHistory.length > maxHistory) {
        eventHistory.splice(0, eventHistory.length - maxHistory);
      }

      // Advance stateful rules first. Enters produce actions to run this tick;
      // exits are queued into pendingExitActions.
      const enterActions = advanceStatefulRules(nextEvent, timestamp);

      // Stateful rules that are currently active suppress competing non-stateful
      // rules so their animation is not interrupted.
      const hasActiveStateful = Object.keys(ruleState).some((id) => ruleState[id] && ruleState[id].active);

      let actions = [];
      if (enterActions.length > 0) {
        actions = enterActions;
      } else if (pendingExitActions.length > 0) {
        actions = pendingExitActions;
        pendingExitActions = [];
      } else if (!hasActiveStateful) {
        const matchedRules = evaluateRules({
          rules: rules.filter((rule) => !isStatefulRule(rule) && shouldEvaluateRuleForEvent(rule, nextEvent)),
          eventHistory,
          now: timestamp,
          lastTriggeredAtByRuleId
        });
        const rule = matchedRules[0];
        if (rule) {
          lastTriggeredAtByRuleId[rule.id] = timestamp;
          const ruleActions = Array.isArray(rule.actions) ? rule.actions : [];
          if (rule.actionStrategy === "random" && ruleActions.length > 0) {
            actions = [ruleActions[Math.floor(Math.random() * ruleActions.length)]];
          } else {
            actions = ruleActions.map((action) => ({ ...action }));
          }
        }
      }

      ensureExitTimer();
      debugRulesLog("evaluate-result", {
        eventType: nextEvent.type,
        eventSource: nextEvent.eventSource,
        actions,
        state: Object.fromEntries(Object.entries(ruleState).map(([id, value]) => [id, {
          active: value.active,
          conditionTrueSince: value.conditionTrueSince,
          exitTrueSince: value.exitTrueSince
        }]))
      });
      return actions;
    },

    getLastTriggeredAtByRuleId() {
      return { ...lastTriggeredAtByRuleId };
    },

    getRuleState() {
      const snapshot = {};
      for (const id of Object.keys(ruleState)) {
        snapshot[id] = { ...ruleState[id] };
      }
      return snapshot;
    },

    getRecentEvents() {
      return eventHistory.slice();
    },

    destroy() {
      if (exitTimer) {
        clearInterval(exitTimer);
        exitTimer = null;
      }
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
