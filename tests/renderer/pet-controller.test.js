import { describe, expect, it, vi } from "vitest";
import {
  createBoundsScheduler,
  createPetController,
  stopPetEvent
} from "../../src/renderer/pet/pet-controller";

function createDeferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createController(overrides = {}) {
  const calls = {
    playState: [],
    messages: [],
    scheduledIdle: 0,
    clearedIdle: 0,
    movedBounds: [],
    dragging: [],
    captured: [],
    released: []
  };

  const controller = createPetController({
    playState: (state) => calls.playState.push(state),
    showMessage: (text) => calls.messages.push(text),
    scheduleIdle: () => {
      calls.scheduledIdle += 1;
    },
    clearIdle: () => {
      calls.clearedIdle += 1;
    },
    movePetWindow: (bounds) => calls.movedBounds.push(bounds),
    getWindowPosition: () => ({ x: 10, y: 20 }),
    getWindowSize: () => ({ width: 320, height: 320 }),
    setDraggingClass: (enabled) => calls.dragging.push(enabled),
    setPointerCapture: (pointerId) => calls.captured.push(pointerId),
    releasePointerCapture: (pointerId) => calls.released.push(pointerId),
    hasPointerCapture: () => true,
    ...overrides
  });

  return { controller, calls };
}

describe("createBoundsScheduler", () => {
  it("coalesces moves to the latest bounds and avoids concurrent setBounds calls", async () => {
    const frames = [];
    const firstMove = createDeferred();
    const setBounds = vi.fn(() => firstMove.promise);
    const scheduler = createBoundsScheduler({
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      setBounds
    });

    scheduler.request({ x: 1, y: 1, width: 320, height: 320 });
    scheduler.request({ x: 2, y: 2, width: 320, height: 320 });
    frames.shift()();

    expect(setBounds).toHaveBeenCalledTimes(1);
    expect(setBounds).toHaveBeenLastCalledWith({ x: 2, y: 2, width: 320, height: 320 });

    scheduler.request({ x: 3, y: 3, width: 320, height: 320 });
    scheduler.request({ x: 4, y: 4, width: 320, height: 320 });

    expect(setBounds).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);

    firstMove.resolve();
    await firstMove.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(frames).toHaveLength(1);
    frames.shift()();
    expect(setBounds).toHaveBeenCalledTimes(2);
    expect(setBounds).toHaveBeenLastCalledWith({ x: 4, y: 4, width: 320, height: 320 });
  });
});

describe("createPetController", () => {
 it("does not drag or suppress click below the movement threshold", () => {
   const { controller, calls } = createController();

   controller.startDrag({ button: 0, pointerId: 7, screenX: 100, screenY: 100 });
   controller.continueDrag({ pointerId: 7, screenX: 102, screenY: 101 });
   controller.endDrag({ pointerId: 7 });
   controller.click();

   expect(calls.movedBounds).toEqual([]);
   expect(calls.playState).toEqual(["click"]);
   expect(calls.messages).toEqual(["Hi there!"]);
   expect(calls.scheduledIdle).toBe(1);
 });

 it("does not fire onDragStart when pointer is pressed without moving", () => {
   const dragStart = vi.fn(() => false);
   const dragging = vi.fn(() => false);
   const dragEnd = vi.fn(() => false);
   const { controller, calls } = createController({
     onDragStart: dragStart,
     onDragging: dragging,
     onDragEnd: dragEnd
   });

   controller.startDrag({ button: 0, pointerId: 7, screenX: 100, screenY: 100 });

   expect(dragStart).not.toHaveBeenCalled();
   expect(dragging).not.toHaveBeenCalled();
   expect(calls.playState).toEqual([]);

   controller.endDrag({ pointerId: 7 });
   expect(dragEnd).not.toHaveBeenCalled();
 });

 it("fires onDragStart only once when threshold is crossed", () => {
   const dragStart = vi.fn(() => false);
   const dragging = vi.fn(() => false);
   const { controller } = createController({
     onDragStart: dragStart,
     onDragging: dragging
   });

   controller.startDrag({ button: 0, pointerId: 7, screenX: 100, screenY: 100 });
   controller.continueDrag({ pointerId: 7, screenX: 130, screenY: 100 });
   controller.continueDrag({ pointerId: 7, screenX: 140, screenY: 100 });

   expect(dragStart).toHaveBeenCalledTimes(1);
   expect(dragging).toHaveBeenCalledTimes(2);
 });

 it("suppresses the accidental click after a drag", () => {
    const { controller, calls } = createController();

    controller.startDrag({ button: 0, pointerId: 7, screenX: 100, screenY: 100 });
    controller.continueDrag({ pointerId: 7, screenX: 130, screenY: 100 });
    controller.endDrag({ pointerId: 7 });
    controller.click();

    expect(calls.playState).toEqual(["drag", "idle"]);
    expect(calls.messages).toEqual([]);
    expect(calls.scheduledIdle).toBe(0);
  });

  it("only resets idle on lost pointer capture after an actual drag", () => {
    const noDrag = createController();

    noDrag.controller.startDrag({ button: 0, pointerId: 7, screenX: 100, screenY: 100 });
    noDrag.controller.lostPointerCapture();

    expect(noDrag.calls.playState).toEqual([]);
    expect(noDrag.calls.dragging).toEqual([true, false]);

    const dragged = createController();

    dragged.controller.startDrag({ button: 0, pointerId: 7, screenX: 100, screenY: 100 });
    dragged.controller.continueDrag({ pointerId: 7, screenX: 130, screenY: 100 });
    dragged.controller.lostPointerCapture();

    expect(dragged.calls.playState).toEqual(["drag", "idle"]);
    expect(dragged.calls.dragging).toEqual([true, false]);
  });
});

describe("stopPetEvent", () => {
  it("stops propagation for settings button events", () => {
    const event = {
      stopPropagation: vi.fn()
    };

    stopPetEvent(event);

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
