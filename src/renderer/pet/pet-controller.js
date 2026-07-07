const DRAG_THRESHOLD_PX = 4;

export function createBoundsScheduler({
  requestFrame = requestAnimationFrame,
  setBounds,
  onError = () => {}
}) {
  let latestBounds = null;
  let frameId = null;
  let inFlight = false;

  function scheduleFlush() {
    if (frameId !== null || inFlight || !latestBounds) return;
    frameId = requestFrame(flush);
  }

  function flush() {
    frameId = null;
    if (inFlight || !latestBounds) return;

    const bounds = latestBounds;
    latestBounds = null;
    inFlight = true;

    Promise.resolve(setBounds(bounds))
      .catch((error) => onError("Failed to move pet window", error))
      .finally(() => {
        inFlight = false;
        scheduleFlush();
      });
  }

  return {
    request(bounds) {
      latestBounds = bounds;
      scheduleFlush();
    }
  };
}

export function stopPetEvent(event) {
  event.stopPropagation();
}

export function createPetController({
  returnToDefault,
  showMessage,
  scheduleIdle,
  clearIdle,
  movePetWindow,
  getWindowPosition,
  getWindowSize,
  setDraggingClass,
  setPointerCapture,
  releasePointerCapture,
  hasPointerCapture,
  onClick = () => false,
  onDragStart = () => false,
  onDragging = () => false,
  onDragEnd = () => false,
  onDragCancel = () => {},
  dragThresholdPx = DRAG_THRESHOLD_PX
}) {
  let dragSession = null;
  let didDrag = false;

  function getBoundsAt(screenX, screenY, offsetX, offsetY) {
    const size = getWindowSize();
    return {
      x: screenX - offsetX,
      y: screenY - offsetY,
      width: size.width,
      height: size.height
    };
  }

  return {
   startDrag(event) {
     if (event.button !== 0) return;

     const position = getWindowPosition();
     clearIdle();
     didDrag = false;
     dragSession = {
       pointerId: event.pointerId,
       offsetX: event.screenX - position.x,
       offsetY: event.screenY - position.y,
       startScreenX: event.screenX,
       startScreenY: event.screenY,
       lastScreenX: event.screenX,
       lastScreenY: event.screenY
     };

     setPointerCapture(event.pointerId);
     setDraggingClass(true);
   },

   continueDrag(event) {
     if (!dragSession || dragSession.pointerId !== event.pointerId) return;

     const distanceX = event.screenX - dragSession.startScreenX;
     const distanceY = event.screenY - dragSession.startScreenY;
     if (!didDrag && Math.hypot(distanceX, distanceY) < dragThresholdPx) return;

     dragSession.lastScreenX = event.screenX;
     dragSession.lastScreenY = event.screenY;
     const firstDrag = !didDrag;
     didDrag = true;
     if (firstDrag) {
       onDragStart(event, { position: getWindowPosition() });
     }
     onDragging(event, {
        startScreenX: dragSession.startScreenX,
        startScreenY: dragSession.startScreenY,
        offsetX: dragSession.offsetX,
        offsetY: dragSession.offsetY,
        distanceX,
        distanceY
      });
      movePetWindow(getBoundsAt(event.screenX, event.screenY, dragSession.offsetX, dragSession.offsetY));
    },

    endDrag(event) {
      if (!dragSession || dragSession.pointerId !== event.pointerId) return;

      if (hasPointerCapture(event.pointerId)) {
        releasePointerCapture(event.pointerId);
      }

      dragSession = null;
      setDraggingClass(false);

      if (didDrag) {
        onDragEnd(event);
        returnToDefault();
      }
    },

    lostPointerCapture() {
      const wasDragging = Boolean(dragSession && didDrag);
      const lastDragSession = dragSession;

      dragSession = null;
      setDraggingClass(false);

      if (wasDragging) {
        onDragCancel({
          pointerId: lastDragSession.pointerId,
          screenX: lastDragSession.lastScreenX,
          screenY: lastDragSession.lastScreenY
        });
        returnToDefault();
      }
    },

    click(event) {
      if (didDrag) {
        didDrag = false;
        return;
      }

      if (onClick(event)) return;

      showMessage("Hi there!");
      scheduleIdle();
    }
  };
}
