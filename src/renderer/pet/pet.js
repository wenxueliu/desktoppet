import {
  createBoundsScheduler,
  createPetController,
  stopPetEvent
} from "./pet-controller.js";
import {
  buildRuntimeModel,
  createRuleRuntime,
  mapProgressThroughKeyframes
} from "./pet-runtime.js";
import { throttle } from "../../shared/throttle.js";
import { createMouseMoveContext, createMouseStillContext } from "../../shared/event-context.js";
import { t, setLocale, initLocale } from "../../shared/i18n.js";
import { EventBus } from "../../shared/event-bus.js";
import { createRendererLogger } from "../shared/logger.js";
import { UserTriggerManager } from "./user-trigger-manager.js";
import { AnimationController } from "./animation-controller.js";
import { createPetMediaRenderer } from "./media-renderer.js";
import { createDebugLogger } from "./debug-utils.js";

// Initialize locale
initLocale();

const sprite = document.querySelector("#pet-sprite");
const spriteImage = document.querySelector("#pet-sprite-image");
const spriteVideo = document.querySelector("#pet-sprite-video");
const spriteCanvas = document.querySelector("#pet-sprite-canvas");
const bubble = document.querySelector("#message-bubble");
const root = document.querySelector("#pet-root");
const logger = createRendererLogger("pet");
const mediaRenderer = createPetMediaRenderer({
  container: sprite,
  image: spriteImage,
  video: spriteVideo,
  canvas: spriteCanvas
});

const defaultSpriteAssets = {
  idle: new URL("../../assets/default-pet/assets/idle.svg", import.meta.url).href,
  click: new URL("../../assets/default-pet/assets/click.svg", import.meta.url).href,
  drag: new URL("../../assets/default-pet/assets/drag.svg", import.meta.url).href
};

let spriteAssets = { ...defaultSpriteAssets };
let stateTimer = 0;
let messageTimer = 0;
let actionSequenceTimer = 0;
let currentConfig = null;
let runtimeModel = buildRuntimeModel({ defaultAssets: defaultSpriteAssets });
let ruleRuntime = createRuleRuntime();
let currentDisplay = {
  locked: false,
  scale: 1,
  opacity: 1,
  mousePassthrough: false
};
let spriteMousePassthrough = null;
let interactionsPaused = false;
let dragStartedAt = 0;
let dragStartPosition = null;
let lastMouseMoveContext = null;
let lastGlobalMouseMoveContext = null;
let hoverStartedAt = 0;
let idleStartedAt = Date.now();
let runtimeTimers = [];
let mouseStillTimers = [];

// Discrete interaction events (click, doubleClick, mouseEnter, mouseLeave, rightClick)
// suppress competing mouseMove rules for a short window so their animation isn't
// interrupted by "enter range" style mouseMove rules. Drag events are handled
// separately via dragStartedAt (continuous suppression for the whole drag).
const MOUSE_MOVE_SUPPRESS_DEFAULT_MS = 1000;
let mouseMoveSuppressedUntil = 0;

// Runtime state push throttling
let lastPushTime = 0;
const PUSH_THROTTLE_MS = 500;

const debugRulesLog = createDebugLogger("[desktop-pet:pet]");

// API and DOM references
let eventBus = null;
let userTriggerManager = null;
let animationController = null;

function isGlobalKeyframeMouseMove(eventContext) {
  return Boolean(
    eventContext &&
    eventContext.type === "mouseMove" &&
    eventContext.eventSource === "globalMouse" &&
    Number.isFinite(Number(eventContext.angleToPetProgress))
  );
}

function playState(state, assetUrl, options = {}) {
  const asset = assetUrl || spriteAssets[state] || spriteAssets.idle;
  const loop = options.loop !== undefined ? options.loop : state === "idle";
  mediaRenderer.render(asset, {
    state,
    loop,
    keyframe: Boolean(options.keyframe),
    progress: options.progress || 0
  });
}

function showMessage(text, durationMs = 1800) {
  window.clearTimeout(messageTimer);
  bubble.textContent = text;
  bubble.hidden = false;

  messageTimer = window.setTimeout(() => {
    bubble.hidden = true;
    bubble.textContent = "";
  }, durationMs);
}

function scheduleIdle(delayMs = 650, returnToState = "idle") {
  window.clearTimeout(stateTimer);
  stateTimer = window.setTimeout(() => playState(returnToState || "idle"), delayMs);
}

function setSpriteMousePassthrough(enabled) {
  const nextEnabled = Boolean(enabled);
  if (spriteMousePassthrough === nextEnabled) return;
  spriteMousePassthrough = nextEnabled;
  if (window.desktopPet && window.desktopPet.pet && window.desktopPet.pet.setMousePassthrough) {
    window.desktopPet.pet.setMousePassthrough(nextEnabled);
  }
}

function getVisibleMediaElement() {
  if (spriteVideo && !spriteVideo.hidden) return spriteVideo;
  if (spriteCanvas && !spriteCanvas.hidden) return spriteCanvas;
  if (spriteImage && !spriteImage.hidden) return spriteImage;
  return sprite;
}

function getMediaIntrinsicSize(element) {
  if (!element) return null;
  if (element === spriteVideo) {
    return spriteVideo.videoWidth && spriteVideo.videoHeight
      ? { width: spriteVideo.videoWidth, height: spriteVideo.videoHeight }
      : null;
  }
  if (element === spriteImage) {
    return spriteImage.naturalWidth && spriteImage.naturalHeight
      ? { width: spriteImage.naturalWidth, height: spriteImage.naturalHeight }
      : null;
  }
  if (element === spriteCanvas) {
    return spriteCanvas.width && spriteCanvas.height
      ? { width: spriteCanvas.width, height: spriteCanvas.height }
      : null;
  }
  return null;
}

function getRenderedMediaScreenRect() {
  const element = getVisibleMediaElement();
  if (!element || typeof element.getBoundingClientRect !== "function") return null;

  const rect = element.getBoundingClientRect();
  const intrinsic = getMediaIntrinsicSize(element);
  let contentWidth = rect.width;
  let contentHeight = rect.height;
  let contentLeft = rect.left;
  let contentTop = rect.top;

  if (intrinsic && intrinsic.width > 0 && intrinsic.height > 0 && rect.width > 0 && rect.height > 0) {
    const mediaRatio = intrinsic.width / intrinsic.height;
    const rectRatio = rect.width / rect.height;

    if (mediaRatio > rectRatio) {
      contentWidth = rect.width;
      contentHeight = rect.width / mediaRatio;
      contentTop = rect.top + (rect.height - contentHeight) / 2;
    } else {
      contentHeight = rect.height;
      contentWidth = rect.height * mediaRatio;
      contentLeft = rect.left + (rect.width - contentWidth) / 2;
    }
  }

  return {
    x: window.screenX + contentLeft,
    y: window.screenY + contentTop,
    width: contentWidth,
    height: contentHeight
  };
}

function isPointInsideRect(point, rect) {
  return Boolean(point && rect) &&
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height;
}

function updateMousePassthroughForPointer(context) {
  if (currentDisplay.mousePassthrough) {
    setSpriteMousePassthrough(true);
    return;
  }

  const pointer = context && (context.screenPosition || context.mousePosition);
  setSpriteMousePassthrough(!isPointInsideRect(pointer, getRenderedMediaScreenRect()));
}

function applyDisplay(display = {}) {
  currentDisplay = {
    ...currentDisplay,
    ...display
  };

  root.style.setProperty("--pet-scale", String(currentDisplay.scale || 1));
  root.style.opacity = String(currentDisplay.opacity || 1);
  if (currentDisplay.mousePassthrough) {
    setSpriteMousePassthrough(true);
  }

  pushRuntimeState();
}

function applyInteractionConfig(interactions = {}) {
  const bubbleConfig = interactions && interactions.bubble && typeof interactions.bubble === "object"
    ? interactions.bubble
    : {};
  const maxWidth = Number(bubbleConfig.maxWidth);
  if (Number.isFinite(maxWidth)) {
    root.style.setProperty("--message-bubble-max-width", `${Math.max(120, Math.min(480, maxWidth))}px`);
  }
}

function clearRuntimeTimers() {
  runtimeTimers.forEach((timerId) => window.clearTimeout(timerId));
  runtimeTimers = [];
  clearMouseStillTimers();
}

function getRuleConditions(rule) {
  if (Array.isArray(rule && rule.conditions)) return rule.conditions;
  if (rule && rule.trigger) return [{ type: rule.trigger, filters: rule.filters || [] }];
  return [];
}

function getRuleExitConditions(rule) {
  const state = rule && rule.state ? rule.state : null;
  return Array.isArray(state && state.exitConditions) ? state.exitConditions : [];
}

function getRuleAllConditions(rule) {
  return [...getRuleConditions(rule), ...getRuleExitConditions(rule)];
}

function runtimeHasCondition(type) {
  return runtimeModel.rules.some((rule) => getRuleAllConditions(rule).some((condition) => (
    (typeof condition === "string" ? condition : condition && condition.type) === type
  )));
}

function getConditionNumber(type, field, fallback) {
  for (const rule of runtimeModel.rules) {
    for (const condition of getRuleConditions(rule)) {
      const normalized = typeof condition === "string" ? { type: condition, filters: [] } : condition;
      if (!normalized || normalized.type !== type || !Array.isArray(normalized.filters)) continue;
      const filter = normalized.filters.find((item) => item && item.field === field && Number.isFinite(Number(item.value)));
      if (filter) return Number(filter.value);
    }
  }
  return fallback;
}

function getMouseStillDurations() {
  const durations = [];
  for (const rule of runtimeModel.rules) {
    for (const condition of getRuleAllConditions(rule)) {
      const normalized = typeof condition === "string" ? { type: condition, filters: [] } : condition;
      if (!normalized || normalized.type !== "mouseStill") continue;

      const durationFilters = Array.isArray(normalized.filters)
        ? normalized.filters.filter((item) => item && item.field === "durationMs")
        : [];

      if (durationFilters.length === 0) {
        durations.push(1000);
        continue;
      }

      durationFilters.forEach((filter) => {
        const thresholds = getMouseStillThresholds(filter);
        durations.push(...thresholds);
      });
    }
  }

  return [...new Set(durations.map((duration) => Math.max(0, duration)).filter((duration) => Number.isFinite(duration)))]
    .sort((left, right) => left - right);
}

function getMouseStillThresholds(filter) {
  if (!filter || filter.field !== "durationMs") return [];
  if (Array.isArray(filter.value)) {
    const values = filter.value.map(Number).filter(Number.isFinite);
    if (values.length === 0) return [];
    return [Math.min(...values)];
  }

  const value = Number(filter.value);
  if (!Number.isFinite(value)) return [];
  return filter.operator === ">" ? [value + 1] : [value];
}

function clearMouseStillTimers() {
  if (mouseStillTimers.length > 0) {
    debugRulesLog("mouse-still:cancel", { count: mouseStillTimers.length });
  }
  mouseStillTimers.forEach((timerId) => window.clearTimeout(timerId));
  mouseStillTimers = [];
}

function scheduleMouseStillEvents(context) {
  clearMouseStillTimers();
  if (!runtimeHasCondition("mouseStill") || !context || context.type !== "mouseMove" || context.eventSource !== "globalMouse") return;

  const startedAt = Date.now();
  const durations = getMouseStillDurations();
  debugRulesLog("mouse-still:schedule", {
    durations,
    mousePosition: context.mousePosition
  });

  durations.forEach((durationMs) => {
    const timerId = window.setTimeout(() => {
      if (interactionsPaused) {
        debugRulesLog("mouse-still:paused", { durationMs });
        return;
      }

      const now = Date.now();
      const eventContext = createMouseStillContext({
        timestamp: now,
        previous: lastGlobalMouseMoveContext || context,
        durationMs: now - startedAt
      });
      debugRulesLog("mouse-still:trigger", {
        durationMs: eventContext.durationMs,
        mousePosition: eventContext.mousePosition
      });
      evaluateRuntimeEvent(eventContext);
    }, durationMs);
    mouseStillTimers.push(timerId);
  });
}

function markInteraction() {
  idleStartedAt = Date.now();
}

function scheduleRuntimeEvents() {
  clearRuntimeTimers();

  if (runtimeHasCondition("idleDuration")) {
    // Use a fixed check interval (every 2 seconds) instead of reading from elapsedMs filter
    const intervalMs = 2000;
    const tickIdle = () => {
      const now = Date.now();
      evaluateRuntimeEvent({
        type: "idleDuration",
        timestamp: now,
        eventSource: "timer",
        elapsedMs: now - idleStartedAt
      });
      runtimeTimers.push(window.setTimeout(tickIdle, intervalMs));
    };
    runtimeTimers.push(window.setTimeout(tickIdle, intervalMs));
  }

  if (runtimeHasCondition("hoverDuration")) {
    // Use a fixed check interval (every 500ms)
    const intervalMs = 500;
    const tickHover = () => {
      if (hoverStartedAt) {
        const now = Date.now();
        evaluateRuntimeEvent({
          ...getPointerContext("hoverDuration"),
          timestamp: now,
          eventSource: "timer",
          elapsedMs: now - hoverStartedAt,
          isInsidePet: true
        });
      }
      runtimeTimers.push(window.setTimeout(tickHover, intervalMs));
    };
    runtimeTimers.push(window.setTimeout(tickHover, intervalMs));
  }

  if (runtimeHasCondition("timer")) {
    // Use a fixed check interval (every 5 seconds)
    const intervalMs = 5000;
    const tickTimer = () => {
      const now = new Date();
      evaluateRuntimeEvent({
        type: "timer",
        timestamp: now.getTime(),
        eventSource: "timer",
        currentTime: now.toISOString(),
        currentHour: now.getHours(),
        dayOfWeek: now.getDay()
      });
      runtimeTimers.push(window.setTimeout(tickTimer, intervalMs));
    };
    runtimeTimers.push(window.setTimeout(tickTimer, intervalMs));
  }

  if (runtimeHasCondition("randomTimer")) {
    const minMs = Math.max(500, getConditionNumber("randomTimer", "minMs", 5000));
    const maxMs = Math.max(minMs, getConditionNumber("randomTimer", "maxMs", minMs * 2));
    const tickRandom = () => {
      const now = new Date();
      evaluateRuntimeEvent({
        type: "randomTimer",
        timestamp: now.getTime(),
        eventSource: "timer",
        currentTime: now.toISOString(),
        currentHour: now.getHours(),
        dayOfWeek: now.getDay()
      });
      runtimeTimers.push(window.setTimeout(tickRandom, minMs + Math.random() * (maxMs - minMs)));
    };
    runtimeTimers.push(window.setTimeout(tickRandom, minMs + Math.random() * (maxMs - minMs)));
  }
}

function initializeActionExecutor() {
  eventBus = new EventBus({ logger });
  userTriggerManager = new UserTriggerManager(eventBus, {
    playAnimation: (animId, options) => {
      if (animationController && animationController.hasClip(animId)) {
        animationController.playAnimation(animId, options);
      } else {
        playState(animId, options.asset);
        if (options.durationMs) {
          scheduleIdle(options.durationMs, options.returnToState || "idle");
        }
      }
    },
    isKeyframeAnimation: (animId) => {
      const clip = runtimeModel && runtimeModel.clipById ? runtimeModel.clipById.get(animId) : null;
      return Boolean(clip && clip.type === "keyframe");
    },
    mapKeyframeProgress: (animId, progress) => {
      const clip = runtimeModel && runtimeModel.clipById ? runtimeModel.clipById.get(animId) : null;
      return mapProgressThroughKeyframes(progress, clip && clip.keyframes);
    },
    setKeyframeProgress: (animId, progress, options) => {
      const hasClip = Boolean(animationController && animationController.hasClip(animId));
      debugRulesLog("action:setKeyframeProgress", {
        animId,
        progress,
        hasClip,
        eventAction: options
      });
      if (animationController && animationController.hasClip(animId)) {
        const applied = animationController.setKeyframeProgress(animId, progress ?? 0);
        debugRulesLog("action:setKeyframeProgress:applied", { animId, progress, applied });
      } else {
        playState(animId, options?.asset, { keyframe: true, progress: progress ?? 0 });
        debugRulesLog("action:setKeyframeProgress:fallback", { animId, progress });
      }
    },
    stopAnimation: () => {
      if (animationController) {
        animationController.stopAnimation();
      } else {
        playState("idle");
      }
    },
    showMessage: (text, options) => {
      const messages = currentConfig?.interactions?.clickMessages || [];
      const displayText = text || (messages.length > 0 ? messages[Math.floor(Math.random() * messages.length)] : "");
      const duration = options?.durationMs || currentConfig?.interactions?.bubble?.durationMs || 1800;
      showMessage(displayText, duration);
    },
    changeDisplay: (action) => {
      if (action.type === "setVisibility") {
        root.style.visibility = action.visible ? "visible" : "hidden";
      } else if (action.scale) {
        applyDisplay({ scale: action.scale });
      } else if (action.opacity) {
        applyDisplay({ opacity: action.opacity });
      }
    },
    resetPosition: () => {
      if (!window.desktopPet || !window.desktopPet.pet) return;
      const display = currentConfig?.display || {};
      window.desktopPet.pet.resetPosition({
        x: display.x || 80,
        y: display.y || 160
      });
    },
    openPanel: () => {
      if (window.desktopPet && window.desktopPet.panel) {
        window.desktopPet.panel.show();
      }
    }
  }, { logger });
}

function initializeAnimationController() {
  const fallbackConfig = {
    default: { id: "idle", asset: spriteAssets.idle || defaultSpriteAssets.idle },
    clips: Object.entries(spriteAssets)
      .filter(([id]) => id !== "idle")
      .map(([id, asset]) => ({
        id,
        asset,
        type: id === "drag" ? "loop" : "oneshot",
        durationMs: 900
      }))
  };
  const animationConfig = runtimeModel.animationConfig?.default?.asset
    ? runtimeModel.animationConfig
    : fallbackConfig;

  animationController = new AnimationController(
    animationConfig,
    {
      renderClip: (asset, options) => {
        mediaRenderer.render(asset, {
          state: options.clipId || "playing",
          loop: Boolean(options.loop),
          keyframe: Boolean(options.keyframe),
          progress: options.progress || 0
        });
      },
      setProgress: (progress) => {
        mediaRenderer.setProgress(progress);
      }
    },
    { logger }
  );
}

function applyRuntime(runtime) {
  currentConfig = runtime && runtime.config ? runtime.config : currentConfig;
  runtimeModel = buildRuntimeModel({
    config: currentConfig || {},
    activePackage: runtime && runtime.package ? runtime.package : null,
    defaultAssets: defaultSpriteAssets
  });
  debugRulesLog("applyRuntime", {
    packageId: currentConfig && currentConfig.currentPackageId,
    ruleCount: runtimeModel.rules.length,
    rules: runtimeModel.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      relation: rule.relation,
      continuous: rule.continuous,
      conditions: rule.conditions,
      actions: rule.actions,
      state: rule.state
    })),
    clips: runtimeModel.animationConfig && runtimeModel.animationConfig.clips
  });
  spriteAssets = runtimeModel.spriteAssets;
  if (ruleRuntime && typeof ruleRuntime.destroy === "function") {
    ruleRuntime.destroy();
  }
  ruleRuntime = createRuleRuntime({
    rules: runtimeModel.rules,
    actionsById: runtimeModel.actionsById,
    onTimerActions: (actions, eventContext) => {
      if (actions.length > 0) {
        executeRuntimeActions(actions, eventContext);
      }
    }
  });

  // Initialize or update animation controller
  if (animationController) {
    animationController.updateConfig(runtimeModel.animationConfig || { default: { id: "idle", asset: spriteAssets.idle || defaultSpriteAssets.idle }, clips: [] });
  }

  applyDisplay((currentConfig && currentConfig.display) || {});
  applyInteractionConfig((currentConfig && currentConfig.interactions) || {});
  interactionsPaused = Boolean(currentConfig && currentConfig.system && currentConfig.system.interactionsPaused);
  scheduleRuntimeEvents();
}

async function loadInitialConfig() {
  if (!window.desktopPet) return;

  try {
    initializeActionExecutor();

    if (window.desktopPet.pet && window.desktopPet.pet.loadRuntime) {
      applyRuntime(await window.desktopPet.pet.loadRuntime());
    } else if (window.desktopPet.config) {
      currentConfig = await window.desktopPet.config.load();

      // Initialize locale from config
      if (currentConfig.system?.language) {
        setLocale(currentConfig.system.language);
      }

      applyRuntime({ config: currentConfig, package: null });
    }

    // Initialize animation controller after runtime is loaded
    initializeAnimationController();

    // Update window title
    document.title = t("pet.title");

    evaluateRuntimeEvent({
      type: "appLaunch",
      timestamp: Date.now(),
      eventSource: "petRenderer"
    });
    evaluateRuntimeEvent({
      type: "packageLoaded",
      timestamp: Date.now(),
      eventSource: "petRenderer"
    });
    playState("idle");
  } catch (error) {
    logger.error("Failed to load pet config", error);
  }
}

function getPetPosition() {
  return {
    x: window.screenX,
    y: window.screenY,
    width: window.outerWidth,
    height: window.outerHeight
  };
}

function getScreenPosition(event) {
  return {
    x: event && Number.isFinite(event.screenX) ? event.screenX : window.screenX,
    y: event && Number.isFinite(event.screenY) ? event.screenY : window.screenY
  };
}

function getPointerContext(type, event) {
  const petPosition = getPetPosition();
  const screenPosition = getScreenPosition(event);

  return {
    type,
    timestamp: Date.now(),
    eventSource: "petRenderer",
    petPosition,
    screenPosition,
    mousePosition: screenPosition,
    mouseLocalPosition: {
      x: screenPosition.x - petPosition.x,
      y: screenPosition.y - petPosition.y
    },
    isInsidePet: true,
    distanceToPetCenter: Math.hypot(
      screenPosition.x - (petPosition.x + petPosition.width / 2),
      screenPosition.y - (petPosition.y + petPosition.height / 2)
    ),
    distanceToPetBounds: 0
  };
}

function getMouseMoveContext(event) {
  const timestamp = Date.now();
  const petPosition = getPetPosition();
  const mousePosition = getScreenPosition(event);
  const context = {
    ...createMouseMoveContext({
      timestamp,
      previous: lastMouseMoveContext,
      mousePosition,
      petPosition
    }),
    eventSource: "petRenderer"
  };
  lastMouseMoveContext = context;
  return context;
}

function getDragContext(type, event) {
  const context = getPointerContext(type, event);
  const currentPosition = getScreenPosition(event);
  const startPosition = dragStartPosition || currentPosition;

  return {
    ...context,
    dragStartPosition: startPosition,
    currentPosition,
    dragDeltaX: currentPosition.x - startPosition.x,
    dragDeltaY: currentPosition.y - startPosition.y,
    dragDistance: Math.hypot(currentPosition.x - startPosition.x, currentPosition.y - startPosition.y),
    dragDurationMs: dragStartedAt ? Math.max(0, context.timestamp - dragStartedAt) : 0
  };
}

function executeRuntimeActions(actions, eventContext = {}) {
  window.clearTimeout(actionSequenceTimer);
  const runAtIndex = (index) => {
    const action = actions[index];
    if (!action) {
      pushRuntimeState();
      return;
    }
    if (userTriggerManager) {
      debugRulesLog("execute-action", {
        index,
        action,
        eventType: eventContext && eventContext.type,
        eventSource: eventContext && eventContext.eventSource,
        angleToPetProgress: eventContext && eventContext.angleToPetProgress
      });
      userTriggerManager.executeAction(action, eventContext);
    }
    if (index + 1 < actions.length) {
      const delayMs = Number.isFinite(action.durationMs) ? action.durationMs : 900;
      actionSequenceTimer = window.setTimeout(() => runAtIndex(index + 1), Math.max(0, delayMs));
    } else if (index + 1 >= actions.length) {
      pushRuntimeState();
    }
  };

  runAtIndex(0);
  return actions.length > 0;
}

// Discrete interaction events whose animation should not be interrupted by
// competing mouseMove rules. Drag events are handled via dragStartedAt instead.
const DISCRETE_INTERACTION_EVENT_TYPES = new Set([
  "click",
  "doubleClick",
  "rightClick",
  "mouseEnter",
  "mouseLeave"
]);

function evaluateRuntimeEvent(eventContext) {
  if (!ruleRuntime || !userTriggerManager) return false;

  // While dragging the pet, suppress competing mouseMove events so the drag
  // animation isn't interrupted by "enter range" style mouseMove rules.
  // Drag, dragStart and dragEnd events themselves are still evaluated.
  if (dragStartedAt && eventContext && eventContext.type === "mouseMove") {
    debugRulesLog("event:suppressed-drag", {
      eventSource: eventContext.eventSource,
      distanceToPetCenter: eventContext.distanceToPetCenter
    });
    return false;
  }

  // After a discrete interaction (click/enter/etc.) fires its animation, keep
  // suppressing mouseMove for the animation window so it isn't overridden.
  if (
    eventContext &&
    eventContext.type === "mouseMove" &&
    !isGlobalKeyframeMouseMove(eventContext) &&
    Date.now() < mouseMoveSuppressedUntil
  ) {
    debugRulesLog("event:suppressed-discrete", {
      eventSource: eventContext.eventSource,
      distanceToPetCenter: eventContext.distanceToPetCenter,
      until: mouseMoveSuppressedUntil,
      now: Date.now()
    });
    return false;
  }

  debugRulesLog("event:evaluate", {
    type: eventContext && eventContext.type,
    eventSource: eventContext && eventContext.eventSource,
    distanceToPetCenter: eventContext && eventContext.distanceToPetCenter,
    distanceToPetBounds: eventContext && eventContext.distanceToPetBounds,
    angleToPetProgress: eventContext && eventContext.angleToPetProgress,
    isInsidePet: eventContext && eventContext.isInsidePet
  });

  const actions = ruleRuntime.evaluateEvent(eventContext);
  debugRulesLog("event:actions", { actions });
  const fired = actions.length > 0 && executeRuntimeActions(actions, eventContext);

  // When a discrete interaction matches a rule, arm the mouseMove suppress
  // window for the duration of the actions it ran.
  if (
    fired &&
    eventContext &&
    DISCRETE_INTERACTION_EVENT_TYPES.has(eventContext.type)
  ) {
    const maxDurationMs = actions.reduce((max, action) => {
      const duration = Number.isFinite(action.durationMs) ? action.durationMs : 0;
      return duration > max ? duration : max;
    }, MOUSE_MOVE_SUPPRESS_DEFAULT_MS);
    mouseMoveSuppressedUntil = Date.now() + Math.max(MOUSE_MOVE_SUPPRESS_DEFAULT_MS, maxDurationMs);
  }

  return fired;
}

function handlePointerDown(event) {
  markInteraction();
  if (interactionsPaused || currentDisplay.locked) {
    return;
  }

  petController.startDrag(event);
}

function handlePetClick(event) {
  markInteraction();
  if (interactionsPaused) {
    stopPetEvent(event);
    return;
  }

  petController.click(event);
}

function handleContextMenu(event) {
  event.preventDefault();
  stopPetEvent(event);
  markInteraction();
  const context = getPointerContext("rightClick", event);

  // Right-click behavior is configured by trigger rules, including the default open-panel rule.
  evaluateRuntimeEvent(context);
}

const boundsScheduler = createBoundsScheduler({
  setBounds: (bounds) => {
    if (!window.desktopPet || !window.desktopPet.pet) return undefined;
    return window.desktopPet.pet.setBounds(bounds);
  },
  onError: (...args) => logger.error(...args)
});

const petController = createPetController({
  playState,
  showMessage,
  scheduleIdle,
  clearIdle: () => window.clearTimeout(stateTimer),
  movePetWindow: (bounds) => boundsScheduler.request(bounds),
  getWindowPosition: () => ({ x: window.screenX, y: window.screenY }),
  getWindowSize: () => ({ width: window.outerWidth, height: window.outerHeight }),
  setDraggingClass: (enabled) => sprite.classList.toggle("dragging", enabled),
  setPointerCapture: (pointerId) => sprite.setPointerCapture(pointerId),
  releasePointerCapture: (pointerId) => sprite.releasePointerCapture(pointerId),
  hasPointerCapture: (pointerId) => sprite.hasPointerCapture(pointerId),
  onClick: (event) => {
    const context = getPointerContext("click", event);
    return evaluateRuntimeEvent(context);
  },
  onDragStart: (event) => {
    dragStartedAt = Date.now();
    dragStartPosition = getScreenPosition(event);
    const context = getDragContext("dragStart", event);
    return evaluateRuntimeEvent(context);
  },
  onDragging: (event) => {
    const context = getDragContext("dragging", event);
    return evaluateRuntimeEvent(context);
  },
  onDragEnd: (event) => {
    const context = getDragContext("dragEnd", event);
    const handled = evaluateRuntimeEvent(context);
    dragStartedAt = 0;
    dragStartPosition = null;
    return handled;
  }
});

sprite.addEventListener("pointerdown", handlePointerDown);
sprite.addEventListener("pointermove", petController.continueDrag);
sprite.addEventListener("pointerup", petController.endDrag);
sprite.addEventListener("pointercancel", petController.endDrag);
sprite.addEventListener("lostpointercapture", petController.lostPointerCapture);

sprite.addEventListener("click", handlePetClick);
sprite.addEventListener("dblclick", (event) => {
  markInteraction();
  if (interactionsPaused) {
    stopPetEvent(event);
    return;
  }
  const context = getPointerContext("doubleClick", event);
  evaluateRuntimeEvent(context);
});
sprite.addEventListener("mouseenter", (event) => {
  markInteraction();
  hoverStartedAt = Date.now();
  const context = getPointerContext("mouseEnter", event);
  evaluateRuntimeEvent(context);
});
sprite.addEventListener("mouseleave", (event) => {
  markInteraction();
  hoverStartedAt = 0;
  const context = getPointerContext("mouseLeave", event);
  evaluateRuntimeEvent(context);
});

// Throttle mousemove to 100ms to avoid excessive event processing
const throttledMouseMove = throttle((event) => {
  if (!interactionsPaused) {
    markInteraction();
    const context = getMouseMoveContext(event);
    evaluateRuntimeEvent(context);
  }
}, 100);

sprite.addEventListener("mousemove", throttledMouseMove);
root.addEventListener("contextmenu", handleContextMenu);

loadInitialConfig();

if (window.desktopPet && window.desktopPet.pet) {
  window.desktopPet.pet.onPlayAnimation((animationId) => {
    if (animationController && animationController.hasClip(animationId)) {
      animationController.playAnimation(animationId);
    }
  });
  window.desktopPet.pet.onDisplayUpdated(applyDisplay);
  window.desktopPet.pet.onRuntimeUpdated((runtime) => {
    applyRuntime(runtime);

    // Re-initialize animation controller with new runtime
    if (animationController) {
      initializeAnimationController();
    }

    evaluateRuntimeEvent({
      type: "packageLoaded",
      timestamp: Date.now(),
      eventSource: "petRenderer"
    });
    playState("idle");
  });
  window.desktopPet.pet.onInteractionsPaused((enabled) => {
    interactionsPaused = enabled;
  });
  window.desktopPet.pet.onGlobalMouseMove((context) => {
    lastGlobalMouseMoveContext = context;
    scheduleMouseStillEvents(context);
    debugRulesLog("global-mouse", {
      distanceToPetCenter: context && context.distanceToPetCenter,
      distanceToPetBounds: context && context.distanceToPetBounds,
      angleToPetProgress: context && context.angleToPetProgress,
      isInsidePet: context && context.isInsidePet,
      mousePosition: context && context.mousePosition
    });
    updateMousePassthroughForPointer(context);
    if (interactionsPaused) {
      debugRulesLog("global-mouse:paused");
      return;
    }
    evaluateRuntimeEvent(context);
  });
}

// Expose runtime state for panel queries
window.__getPetRuntimeState = function () {
  if (!runtimeModel || !ruleRuntime) {
    return null;
  }

  const currentClip = animationController && typeof animationController.getCurrentClip === "function"
    ? animationController.getCurrentClip()
    : null;
  const currentState = (currentClip && currentClip.id) || sprite.dataset.state || "idle";
  const currentSprite = mediaRenderer.getCurrentAsset() || (currentClip && currentClip.asset) || "";

  return {
    currentState: {
      animation: currentState,
      animationState: animationController && typeof animationController.getCurrentState === "function" ? animationController.getCurrentState() : sprite.dataset.state || "idle",
      sprite: currentSprite,
      position: { x: window.screenX, y: window.screenY },
      display: {
        scale: currentDisplay.scale || 1,
        opacity: currentDisplay.opacity || 1,
        alwaysOnTop: true
      }
    },
    recentEvents: ruleRuntime.getRecentEvents().slice(-10),
    ruleStates: ruleRuntime.getLastTriggeredAtByRuleId(),
    statefulStates: typeof ruleRuntime.getRuleState === "function" ? ruleRuntime.getRuleState() : {},
    timers: {
      idleStartedAt,
      hoverStartedAt,
      dragStartedAt
    },
    interactionsPaused
  };
};

// Push runtime state with throttling
function pushRuntimeState() {
  if (!window.desktopPet || !window.desktopPet.pet || !window.desktopPet.pet.pushRuntimeState) {
    return;
  }

  const now = Date.now();
  if (now - lastPushTime < PUSH_THROTTLE_MS) {
    return;
  }

  lastPushTime = now;

  const state = window.__getPetRuntimeState();
  if (state) {
    window.desktopPet.pet.pushRuntimeState(state);
  }
}
