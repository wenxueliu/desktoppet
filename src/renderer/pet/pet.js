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

const sprite = document.querySelector("#pet-sprite");
const bubble = document.querySelector("#message-bubble");
const settingsButton = document.querySelector("#settings-button");
const root = document.querySelector("#pet-root");

const defaultSpriteAssets = {
  idle: new URL("../../assets/default-pet/assets/idle.svg", import.meta.url).href,
  click: new URL("../../assets/default-pet/assets/click.svg", import.meta.url).href,
  drag: new URL("../../assets/default-pet/assets/drag.svg", import.meta.url).href
};

let spriteAssets = { ...defaultSpriteAssets };
let stateTimer = 0;
let messageTimer = 0;
let currentConfig = null;
let runtimeModel = buildRuntimeModel({ defaultAssets: defaultSpriteAssets });
let ruleRuntime = createRuleRuntime();
let currentDisplay = {
  locked: false,
  scale: 1,
  opacity: 1,
  showHoverButtons: true
};
let interactionsPaused = false;
let dragStartedAt = 0;
let dragStartPosition = null;

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
  root.classList.toggle("hide-hover-buttons", currentDisplay.showHoverButtons === false);
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
}

async function loadInitialConfig() {
  if (!window.desktopPet) return;

  try {
    if (window.desktopPet.pet && window.desktopPet.pet.loadRuntime) {
      applyRuntime(await window.desktopPet.pet.loadRuntime());
    } else if (window.desktopPet.config) {
      currentConfig = await window.desktopPet.config.load();
      applyRuntime({ config: currentConfig, package: null });
    }
    applyDisplay((currentConfig && currentConfig.display) || {});
    interactionsPaused = Boolean(currentConfig.system && currentConfig.system.interactionsPaused);
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
  let handled = false;
  for (const action of actions) {
    handled = executeRuntimeAction(action, {
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
    }) || handled;
  }
  return handled;
}

function evaluateRuntimeEvent(eventContext) {
  if (!ruleRuntime) return false;
  const actions = ruleRuntime.evaluateEvent(eventContext);
  return actions.length > 0 && executeActions(actions);
}

function handlePointerDown(event) {
  if (interactionsPaused || currentDisplay.locked) {
    return;
  }

  petController.startDrag(event);
}

function handlePetClick(event) {
  if (interactionsPaused) {
    stopPetEvent(event);
    return;
  }

  petController.click(event);
}

async function openContextMenu(event) {
  event.preventDefault();
  stopPetEvent(event);

  if (!window.desktopPet || !window.desktopPet.menu) return;

  try {
    await window.desktopPet.menu.openContextMenu();
  } catch (error) {
    console.error("Failed to open desktop pet menu", error);
  }
}

function runConfiguredAction(actionId) {
  const action = runtimeModel.actionsById[actionId];
  if (!action) return;
  executeActions([action]);
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
  onClick: (event) => evaluateRuntimeEvent(getPointerContext("click", event)),
  onDragStart: (event) => {
    dragStartedAt = Date.now();
    dragStartPosition = getScreenPosition(event);
    return evaluateRuntimeEvent(getDragContext("dragStart", event));
  },
  onDragging: (event) => evaluateRuntimeEvent(getDragContext("dragging", event)),
  onDragEnd: (event) => {
    const handled = evaluateRuntimeEvent(getDragContext("dragEnd", event));
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
root.addEventListener("contextmenu", openContextMenu);

settingsButton.addEventListener("pointerdown", stopPetEvent);
settingsButton.addEventListener("pointerup", stopPetEvent);
settingsButton.addEventListener("click", async (event) => {
  stopPetEvent(event);

  try {
    await window.desktopPet.panel.show();
  } catch (error) {
    console.error("Failed to show settings panel", error);
  }
});
settingsButton.addEventListener("contextmenu", stopPetEvent);

loadInitialConfig();

if (window.desktopPet && window.desktopPet.pet) {
  window.desktopPet.pet.onSwitchState((state) => {
    playState(state);
    scheduleIdle();
  });
  window.desktopPet.pet.onRunAction(runConfiguredAction);
  window.desktopPet.pet.onDisplayUpdated(applyDisplay);
  window.desktopPet.pet.onInteractionsPaused((enabled) => {
    interactionsPaused = enabled;
  });
}
