import {
  createBoundsScheduler,
  createPetController,
  stopPetEvent
} from "./pet-controller.js";
import {
  buildRuntimeModel,
  createRuleRuntime,
  executeRuntimeAction
} from "./pet-runtime.js";
import { throttle } from "../../shared/throttle.js";
import { t, setLocale, initLocale } from "../../shared/i18n.js";
import { EventBus } from "../../shared/event-bus.js";
import { SystemEventManager } from "./system-event-manager.js";
import { UserTriggerManager } from "./user-trigger-manager.js";
import { AnimationController } from "./animation-controller.js";

// Initialize locale
initLocale();

const sprite = document.querySelector("#pet-sprite");
const bubble = document.querySelector("#message-bubble");
const root = document.querySelector("#pet-root");

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
  opacity: 1
};
let interactionsPaused = false;
let dragStartedAt = 0;
let dragStartPosition = null;
let lastMouseMoveContext = null;
let hoverStartedAt = 0;
let idleStartedAt = Date.now();
let runtimeTimers = [];

// Runtime state push throttling
let lastPushTime = 0;
const PUSH_THROTTLE_MS = 500;

// New event bus system
let eventBus = null;
let systemEventManager = null;
let userTriggerManager = null;
let animationController = null;

function playState(state, assetUrl) {
  sprite.src = assetUrl || spriteAssets[state] || spriteAssets.idle;
  sprite.dataset.state = state;
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

function applyDisplay(display = {}) {
  currentDisplay = {
    ...currentDisplay,
    ...display
  };

  root.style.setProperty("--pet-scale", String(currentDisplay.scale || 1));
  root.style.opacity = String(currentDisplay.opacity || 1);

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
}

function getRuleConditions(rule) {
  if (Array.isArray(rule && rule.conditions)) return rule.conditions;
  if (rule && rule.trigger) return [{ type: rule.trigger, filters: rule.filters || [] }];
  return [];
}

function runtimeHasCondition(type) {
  return runtimeModel.rules.some((rule) => getRuleConditions(rule).some((condition) => (
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

function initializeEventBus() {
  eventBus = new EventBus();

  systemEventManager = new SystemEventManager(eventBus, {
    startWindowDrag: (event) => {
      dragStartedAt = Date.now();
      dragStartPosition = { x: event.screenX || 0, y: event.screenY || 0 };
    },
    updateWindowPosition: () => {},
    endWindowDrag: () => {
      dragStartedAt = 0;
      dragStartPosition = null;
    },
    openPanel: () => {
      if (window.desktopPet && window.desktopPet.panel) {
        window.desktopPet.panel.show();
      }
    },
    onAppLaunch: () => {},
    onPackageLoaded: () => {}
  });

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
  });
}

function initializeAnimationController() {
  const idleAsset = spriteAssets.idle || defaultSpriteAssets.idle;

  const clips = [];
  Object.entries(spriteAssets).forEach(([id, asset]) => {
    if (id === "idle") return;
    clips.push({
      id,
      asset,
      type: "oneshot",
      durationMs: 900
    });
  });

  animationController = new AnimationController(
    { default: { id: "idle", asset: idleAsset }, clips },
    {
      renderClip: (asset, options) => {
        sprite.src = asset;
        sprite.dataset.state = options.clipId || "playing";
      }
    }
  );
}

function applyRuntime(runtime) {
  currentConfig = runtime && runtime.config ? runtime.config : currentConfig;
  runtimeModel = buildRuntimeModel({
    config: currentConfig || {},
    activePackage: runtime && runtime.package ? runtime.package : null,
    defaultAssets: defaultSpriteAssets
  });
  spriteAssets = runtimeModel.spriteAssets;
  ruleRuntime = createRuleRuntime({
    rules: runtimeModel.rules,
    actionsById: runtimeModel.actionsById
  });

  // Initialize or update animation controller
  if (animationController) {
    animationController.updateConfig(runtimeModel.animationConfig || { default: { id: "idle", asset: spriteAssets.idle || defaultSpriteAssets.idle }, clips: [] });
  }

  // Load user triggers into event bus
  if (userTriggerManager && runtimeModel.rules) {
    userTriggerManager.loadTriggers(runtimeModel.rules);
  }

  applyDisplay((currentConfig && currentConfig.display) || {});
  applyInteractionConfig((currentConfig && currentConfig.interactions) || {});
  interactionsPaused = Boolean(currentConfig && currentConfig.system && currentConfig.system.interactionsPaused);
  scheduleRuntimeEvents();
}

async function loadInitialConfig() {
  if (!window.desktopPet) return;

  try {
    // Initialize event bus system
    initializeEventBus();

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

    // Emit lifecycle events to event bus
    if (eventBus) {
      eventBus.emit("appLaunch", {
        timestamp: Date.now(),
        eventSource: "petRenderer"
      });
      eventBus.emit("packageLoaded", {
        timestamp: Date.now(),
        eventSource: "petRenderer"
      });
    }

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
    console.error("Failed to load pet config", error);
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
  const previousPosition = lastMouseMoveContext && lastMouseMoveContext.mousePosition;
  const deltaX = previousPosition ? mousePosition.x - previousPosition.x : 0;
  const deltaY = previousPosition ? mousePosition.y - previousPosition.y : 0;
  const elapsedMs = lastMouseMoveContext && Number.isFinite(lastMouseMoveContext.timestamp)
    ? Math.max(0, timestamp - lastMouseMoveContext.timestamp)
    : 0;
  const distance = Math.hypot(deltaX, deltaY);
  const petCenter = {
    x: petPosition.x + petPosition.width / 2,
    y: petPosition.y + petPosition.height / 2
  };
  const currentDistance = Math.hypot(mousePosition.x - petCenter.x, mousePosition.y - petCenter.y);
  const previousDistance = previousPosition
    ? Math.hypot(previousPosition.x - petCenter.x, previousPosition.y - petCenter.y)
    : currentDistance;
  const context = {
    ...getPointerContext("mouseMove", event),
    timestamp,
    deltaX,
    deltaY,
    speed: elapsedMs > 0 ? distance / (elapsedMs / 1000) : 0,
    direction: Math.abs(deltaX) >= Math.abs(deltaY)
      ? (deltaX === 0 ? "none" : (deltaX > 0 ? "right" : "left"))
      : (deltaY > 0 ? "down" : "up"),
    isMovingTowardPet: currentDistance < previousDistance,
    isMovingAwayFromPet: currentDistance > previousDistance
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

function executeActions(actions) {
  window.clearTimeout(actionSequenceTimer);
  const runAtIndex = (index) => {
    const action = actions[index];
    if (!action) {
      pushRuntimeState();
      return;
    }
    const handled = executeRuntimeAction(action, {
      playState,
      showMessage,
      scheduleIdle,
      applyDisplayPatch: applyDisplay,
      setHidden: (hidden) => {
        root.style.visibility = hidden ? "hidden" : "visible";
      },
      resetPosition: () => {
        if (!window.desktopPet.pet || !window.desktopPet.pet.resetPosition) return undefined;
        const display = (currentConfig && currentConfig.display) || {};
        return window.desktopPet.pet.resetPosition({
          x: display.x || 80,
          y: display.y || 160
        });
      },
      openPanel: () => (window.desktopPet.panel && window.desktopPet.panel.show
        ? window.desktopPet.panel.show()
        : undefined)
    }, runtimeModel.clipById);
    if (handled && index + 1 < actions.length) {
      const delayMs = Number.isFinite(action.durationMs) ? action.durationMs : 900;
      actionSequenceTimer = window.setTimeout(() => runAtIndex(index + 1), Math.max(0, delayMs));
    } else if (index + 1 >= actions.length) {
      pushRuntimeState();
    }
  };

  runAtIndex(0);
  return actions.length > 0;
}

function evaluateRuntimeEvent(eventContext) {
  if (!ruleRuntime) return false;
  const actions = ruleRuntime.evaluateEvent(eventContext);
  return actions.length > 0 && executeActions(actions);
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
  }
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
    // Emit to event bus
    if (eventBus) {
      eventBus.emit("click", context);
    }
    return evaluateRuntimeEvent(context);
  },
  onDragStart: (event) => {
    dragStartedAt = Date.now();
    dragStartPosition = getScreenPosition(event);
    const context = getDragContext("dragStart", event);
    // Emit to event bus
    if (eventBus) {
      eventBus.emit("dragStart", context);
    }
    return evaluateRuntimeEvent(context);
  },
  onDragging: (event) => {
    const context = getDragContext("dragging", event);
    // Emit to event bus
    if (eventBus) {
      eventBus.emit("dragging", context);
    }
    return evaluateRuntimeEvent(context);
  },
  onDragEnd: (event) => {
    const context = getDragContext("dragEnd", event);
    // Emit to event bus
    if (eventBus) {
      eventBus.emit("dragEnd", context);
    }
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
  // Emit to event bus
  if (eventBus) {
    eventBus.emit("doubleClick", context);
  }
  evaluateRuntimeEvent(context);
});
sprite.addEventListener("mouseenter", (event) => {
  markInteraction();
  hoverStartedAt = Date.now();
  const context = getPointerContext("mouseEnter", event);
  // Emit to event bus
  if (eventBus) {
    eventBus.emit("mouseEnter", context);
  }
  evaluateRuntimeEvent(context);
});
sprite.addEventListener("mouseleave", (event) => {
  markInteraction();
  hoverStartedAt = 0;
  const context = getPointerContext("mouseLeave", event);
  // Emit to event bus
  if (eventBus) {
    eventBus.emit("mouseLeave", context);
  }
  evaluateRuntimeEvent(context);
});

// Throttle mousemove to 100ms to avoid excessive event processing
const throttledMouseMove = throttle((event) => {
  if (!interactionsPaused) {
    markInteraction();
    const context = getMouseMoveContext(event);
    // Emit to event bus
    if (eventBus) {
      eventBus.emit("mouseMove", context);
    }
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

    // Emit to event bus
    if (eventBus) {
      eventBus.emit("packageLoaded", {
        timestamp: Date.now(),
        eventSource: "petRenderer"
      });
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
}

// Expose runtime state for panel queries
window.__getPetRuntimeState = function () {
  if (!runtimeModel || !ruleRuntime || !eventBus) {
    return null;
  }

  const currentState = sprite.dataset.state || "idle";
  const currentSprite = sprite.src || "";

  return {
    currentState: {
      animation: currentState,
      sprite: currentSprite,
      position: { x: window.screenX, y: window.screenY },
      display: {
        scale: currentDisplay.scale || 1,
        opacity: currentDisplay.opacity || 1,
        alwaysOnTop: true
      }
    },
    recentEvents: eventBus.eventHistory.slice(-10),
    ruleStates: ruleRuntime.getLastTriggeredAtByRuleId(),
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
