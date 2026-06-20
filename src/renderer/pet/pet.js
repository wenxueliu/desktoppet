import {
  createBoundsScheduler,
  createPetController,
  stopPetEvent
} from "./pet-controller.js";

const sprite = document.querySelector("#pet-sprite");
const bubble = document.querySelector("#message-bubble");
const settingsButton = document.querySelector("#settings-button");

const spriteAssets = {
  idle: new URL("../../assets/default-pet/assets/idle.svg", import.meta.url).href,
  click: new URL("../../assets/default-pet/assets/click.svg", import.meta.url).href,
  drag: new URL("../../assets/default-pet/assets/drag.svg", import.meta.url).href
};

let stateTimer = 0;
let messageTimer = 0;

function playState(state) {
  sprite.src = spriteAssets[state] || spriteAssets.idle;
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

function scheduleIdle(delayMs = 650) {
  window.clearTimeout(stateTimer);
  stateTimer = window.setTimeout(() => playState("idle"), delayMs);
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
  hasPointerCapture: (pointerId) => sprite.hasPointerCapture(pointerId)
});

sprite.addEventListener("pointerdown", petController.startDrag);
sprite.addEventListener("pointermove", petController.continueDrag);
sprite.addEventListener("pointerup", petController.endDrag);
sprite.addEventListener("pointercancel", petController.endDrag);
sprite.addEventListener("lostpointercapture", petController.lostPointerCapture);

sprite.addEventListener("click", petController.click);

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

playState("idle");
