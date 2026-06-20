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
let dragSession = null;
let didDrag = false;

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

function getWindowBoundsAt(screenX, screenY, offsetX, offsetY) {
  return {
    x: screenX - offsetX,
    y: screenY - offsetY,
    width: window.outerWidth,
    height: window.outerHeight
  };
}

async function movePetWindow(bounds) {
  if (!window.desktopPet || !window.desktopPet.pet) return;

  try {
    await window.desktopPet.pet.setBounds(bounds);
  } catch (error) {
    console.error("Failed to move pet window", error);
  }
}

function startDrag(event) {
  if (event.button !== 0) return;

  window.clearTimeout(stateTimer);
  didDrag = false;
  dragSession = {
    pointerId: event.pointerId,
    offsetX: event.screenX - window.screenX,
    offsetY: event.screenY - window.screenY,
    startScreenX: event.screenX,
    startScreenY: event.screenY
  };

  sprite.setPointerCapture(event.pointerId);
  sprite.classList.add("dragging");
}

function continueDrag(event) {
  if (!dragSession || dragSession.pointerId !== event.pointerId) return;

  const distanceX = event.screenX - dragSession.startScreenX;
  const distanceY = event.screenY - dragSession.startScreenY;
  if (!didDrag && Math.hypot(distanceX, distanceY) < 4) return;

  didDrag = true;
  playState("drag");
  movePetWindow(getWindowBoundsAt(event.screenX, event.screenY, dragSession.offsetX, dragSession.offsetY));
}

function endDrag(event) {
  if (!dragSession || dragSession.pointerId !== event.pointerId) return;

  if (sprite.hasPointerCapture(event.pointerId)) {
    sprite.releasePointerCapture(event.pointerId);
  }

  dragSession = null;
  sprite.classList.remove("dragging");
  playState("idle");
}

sprite.addEventListener("pointerdown", startDrag);
sprite.addEventListener("pointermove", continueDrag);
sprite.addEventListener("pointerup", endDrag);
sprite.addEventListener("pointercancel", endDrag);
sprite.addEventListener("lostpointercapture", () => {
  dragSession = null;
  sprite.classList.remove("dragging");
  playState("idle");
});

sprite.addEventListener("click", () => {
  if (didDrag) {
    didDrag = false;
    return;
  }

  playState("click");
  showMessage("Hi there!");
  scheduleIdle();
});

settingsButton.addEventListener("click", async () => {
  try {
    await window.desktopPet.panel.show();
  } catch (error) {
    console.error("Failed to show settings panel", error);
  }
});

playState("idle");
