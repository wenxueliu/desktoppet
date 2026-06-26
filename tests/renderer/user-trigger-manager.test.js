import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/shared/event-bus.js";
import { UserTriggerManager } from "../../src/renderer/pet/user-trigger-manager.js";

describe("UserTriggerManager", () => {
  let eventBus;
  let actionExecutors;
  let manager;

  beforeEach(() => {
    eventBus = new EventBus();
    actionExecutors = {
      playAnimation: vi.fn(),
      isKeyframeAnimation: vi.fn(() => false),
      setKeyframeProgress: vi.fn(),
      stopAnimation: vi.fn(),
      showMessage: vi.fn(),
      changeDisplay: vi.fn(),
      resetPosition: vi.fn(),
      openPanel: vi.fn()
    };
  });

  describe("constructor", () => {
    it("should create instance with valid parameters", () => {
      manager = new UserTriggerManager(eventBus, actionExecutors);

      expect(manager).toBeDefined();
      expect(manager.eventBus).toBe(eventBus);
      expect(manager.actionExecutors).toBe(actionExecutors);
    });

    it("should throw error if eventBus is missing", () => {
      expect(() => new UserTriggerManager(null, actionExecutors)).toThrow();
    });

    it("should work without action executors", () => {
      manager = new UserTriggerManager(eventBus);

      expect(manager).toBeDefined();
    });
  });

  describe("loadTriggers", () => {
    beforeEach(() => {
      manager = new UserTriggerManager(eventBus, actionExecutors);
    });

    it("should load simple triggers", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);

      expect(manager.getTriggers().length).toBe(1);
      expect(manager.getListenerIds().length).toBeGreaterThan(0);
    });

    it("should skip disabled triggers", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: false,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: []
        }
      ];

      manager.loadTriggers(triggers);

      expect(manager.getTriggers().length).toBe(0);
    });

    it("should skip triggers without conditions", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          actions: []
        }
      ];

      manager.loadTriggers(triggers);

      expect(manager.getListenerIds().length).toBe(0);
    });

    it("should replace existing triggers", () => {
      const triggers1 = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: []
        }
      ];

      const triggers2 = [
        {
          id: "trigger-2",
          enabled: true,
          relation: "single",
          conditions: [{ type: "drag" }],
          actions: []
        }
      ];

      manager.loadTriggers(triggers1);
      const ids1 = manager.getListenerIds();

      manager.loadTriggers(triggers2);
      const ids2 = manager.getListenerIds();

      expect(ids1).not.toEqual(ids2);
      expect(manager.getTriggers()[0].id).toBe("trigger-2");
    });

    it("should handle invalid input gracefully", () => {
      expect(() => {
        manager.loadTriggers(null);
        manager.loadTriggers("not an array");
        manager.loadTriggers({});
      }).not.toThrow();
    });
  });

  describe("simple triggers (single/or)", () => {
    beforeEach(() => {
      manager = new UserTriggerManager(eventBus, actionExecutors);
    });

    it("should trigger on matching event", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);
      expect(actionExecutors.playAnimation).toHaveBeenCalledWith("jump", expect.any(Object));
    });

    it("should not trigger on non-matching event", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("drag", {});

      expect(actionExecutors.playAnimation).not.toHaveBeenCalled();
    });

    it("should handle OR relation (multiple conditions)", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "or",
          conditions: [
            { type: "click" },
            { type: "doubleClick" }
          ],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("click", {});
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      eventBus.emit("doubleClick", {});
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(2);
    });
  });

  describe("filters", () => {
    beforeEach(() => {
      manager = new UserTriggerManager(eventBus, actionExecutors);
    });

    it("should match filter with = operator", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{
            type: "click",
            filters: [{ field: "isInsidePet", operator: "=", value: true }]
          }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("click", { isInsidePet: true });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      eventBus.emit("click", { isInsidePet: false });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should match filter with != operator", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{
            type: "click",
            filters: [{ field: "button", operator: "!=", value: "right" }]
          }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("click", { button: "left" });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      eventBus.emit("click", { button: "right" });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should match filter with > operator", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{
            type: "mouseMove",
            filters: [{ field: "speed", operator: ">", value: 100 }]
          }],
          actions: [{ type: "playAnimation", animation: "run" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("mouseMove", { speed: 150 });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      eventBus.emit("mouseMove", { speed: 50 });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should match filter with between operator", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{
            type: "mouseMove",
            filters: [{ field: "distance", operator: "between", value: [50, 100] }]
          }],
          actions: [{ type: "playAnimation", animation: "curious" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("mouseMove", { distance: 75 });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      eventBus.emit("mouseMove", { distance: 150 });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should match filter with in operator", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{
            type: "timer",
            filters: [{ field: "hour", operator: "in", value: [9, 10, 11, 12] }]
          }],
          actions: [{ type: "showMessage", text: "Morning!" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("timer", { hour: 10 });
      expect(actionExecutors.showMessage).toHaveBeenCalledTimes(1);

      eventBus.emit("timer", { hour: 15 });
      expect(actionExecutors.showMessage).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should match multiple filters (AND logic)", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{
            type: "mouseMove",
            filters: [
              { field: "speed", operator: ">", value: 100 },
              { field: "isMovingTowardPet", operator: "=", value: true }
            ]
          }],
          actions: [{ type: "playAnimation", animation: "scared" }]
        }
      ];

      manager.loadTriggers(triggers);

      // Both conditions true
      eventBus.emit("mouseMove", { speed: 150, isMovingTowardPet: true });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      // Only one condition true
      eventBus.emit("mouseMove", { speed: 150, isMovingTowardPet: false });
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe("AND triggers", () => {
    beforeEach(() => {
      manager = new UserTriggerManager(eventBus, actionExecutors);
    });

    it("should trigger when all conditions met within time window", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "and",
          andWindowMs: 3000,
          conditions: [
            { type: "mouseEnter" },
            { type: "click" }
          ],
          actions: [{ type: "playAnimation", animation: "excited" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("mouseEnter", {});
      eventBus.emit("click", {});

      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);
    });

    it("should not trigger if conditions not all met", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "and",
          andWindowMs: 3000,
          conditions: [
            { type: "mouseEnter" },
            { type: "click" }
          ],
          actions: [{ type: "playAnimation", animation: "excited" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("mouseEnter", {});
      // No click event

      expect(actionExecutors.playAnimation).not.toHaveBeenCalled();
    });

    it("should not trigger if conditions outside time window", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "and",
          andWindowMs: 1000, // 1 second window
          conditions: [
            { type: "mouseEnter" },
            { type: "click" }
          ],
          actions: [{ type: "playAnimation", animation: "excited" }]
        }
      ];

      manager.loadTriggers(triggers);

      // Emit mouseEnter with old timestamp
      eventBus.emit("mouseEnter", { timestamp: Date.now() - 2000 });
      eventBus.emit("click", {});

      expect(actionExecutors.playAnimation).not.toHaveBeenCalled();
    });
  });

  describe("cooldown", () => {
    beforeEach(() => {
      manager = new UserTriggerManager(eventBus, actionExecutors);
    });

    it("should respect cooldown period", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          cooldownMs: 1000,
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("click", {});
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      // Immediate second click should be ignored
      eventBus.emit("click", {});
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);
    });

    it("should allow trigger after cooldown expires", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          cooldownMs: 100,
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);

      eventBus.emit("click", {});
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      // Wait for cooldown
      return new Promise(resolve => {
        setTimeout(() => {
          eventBus.emit("click", {});
          expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(2);
          resolve();
        }, 150);
      });
    });

    it("should get cooldown status", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          cooldownMs: 1000,
          conditions: [{ type: "click" }],
          actions: []
        }
      ];

      manager.loadTriggers(triggers);

      // Before triggering
      let status = manager.getCooldownStatus("trigger-1");
      expect(status.onCooldown).toBe(false);

      // After triggering
      eventBus.emit("click", {});
      status = manager.getCooldownStatus("trigger-1");
      expect(status.onCooldown).toBe(true);
      expect(status.remainingMs).toBeGreaterThan(0);
    });
  });

  describe("action execution", () => {
    beforeEach(() => {
      manager = new UserTriggerManager(eventBus, actionExecutors);
    });

    it("should execute playAnimation action", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      expect(actionExecutors.playAnimation).toHaveBeenCalledWith("jump", expect.any(Object));
    });

    it("should execute showMessage action", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "showMessage", text: "Hello!" }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      expect(actionExecutors.showMessage).toHaveBeenCalledWith("Hello!", expect.any(Object));
    });

    it("should execute randomMessage action", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "randomMessage", messages: ["Hi!", "Hello!", "Hey!"] }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      expect(actionExecutors.showMessage).toHaveBeenCalledTimes(1);
      const calledMessage = actionExecutors.showMessage.mock.calls[0][0];
      expect(["Hi!", "Hello!", "Hey!"]).toContain(calledMessage);
    });

    it("should execute multiple actions in sequence", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [
            { type: "playAnimation", animation: "jump" },
            { type: "showMessage", text: "Wheee!" }
          ],
          actionStrategy: "sequence"
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);
      expect(actionExecutors.showMessage).toHaveBeenCalledTimes(1);
    });

    it("should execute random action when strategy is random", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [
            { type: "playAnimation", animation: "jump" },
            { type: "playAnimation", animation: "wave" },
            { type: "playAnimation", animation: "spin" }
          ],
          actionStrategy: "random"
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      // Only one action should execute
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);
      const calledAnim = actionExecutors.playAnimation.mock.calls[0][0];
      expect(["jump", "wave", "spin"]).toContain(calledAnim);
    });

    it("should resolve keyframe progress from global mouse event context", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "mouseMove" }],
          actions: [{ type: "setKeyframeProgress", animation: "look", progressFrom: "angleToPetProgress", scale: 0.5, offset: 0.1 }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("mouseMove", { eventSource: "globalMouse", angleToPetProgress: 0.6 });

      expect(actionExecutors.setKeyframeProgress).toHaveBeenCalledWith("look", 0.4, expect.any(Object));
    });

    it("should ignore keyframe progress from non-global mouse events", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "mouseMove" }],
          actions: [{ type: "setKeyframeProgress", animation: "look", progressFrom: "angleToPetProgress" }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("mouseMove", { eventSource: "petRenderer", angleToPetProgress: 0.6 });

      expect(actionExecutors.setKeyframeProgress).not.toHaveBeenCalled();
    });

    it("should only play keyframe animations from global mouse events", () => {
      actionExecutors.isKeyframeAnimation.mockImplementation((animId) => animId === "look");
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "mouseMove" }],
          actions: [{ type: "playAnimation", animation: "look", progressFrom: "angleToPetProgress" }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("mouseMove", { eventSource: "petRenderer", angleToPetProgress: 0.25 });
      expect(actionExecutors.playAnimation).not.toHaveBeenCalled();

      eventBus.emit("mouseMove", { eventSource: "globalMouse", angleToPetProgress: 0.25 });
      expect(actionExecutors.playAnimation).toHaveBeenCalledWith("look", expect.objectContaining({ progress: 0.25 }));
    });

    it("should handle string format actions", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: ["play:jump", "message:Hi!"]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      expect(actionExecutors.playAnimation).toHaveBeenCalledWith("jump", expect.any(Object));
      expect(actionExecutors.showMessage).toHaveBeenCalledWith("Hi!", expect.any(Object));
    });
  });

  describe("interruptCurrent", () => {
    beforeEach(() => {
      manager = new UserTriggerManager(eventBus, actionExecutors);
    });

    it("should return true when interruptCurrent is set", () => {
      const userHandler = vi.fn();
      eventBus.subscribe("click", userHandler, { priority: 30 });

      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }],
          interruptCurrent: true,
          priority: 50
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      // Lower priority handler should not execute
      expect(userHandler).not.toHaveBeenCalled();
    });

    it("should return false when interruptCurrent is not set", () => {
      const userHandler = vi.fn();
      eventBus.subscribe("click", userHandler, { priority: 30 });

      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }],
          priority: 50
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      // Lower priority handler should execute
      expect(userHandler).toHaveBeenCalled();
    });
  });

  describe("unloadTriggers", () => {
    beforeEach(() => {
      manager = new UserTriggerManager(eventBus, actionExecutors);
    });

    it("should remove all listeners", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);
      expect(manager.getListenerIds().length).toBeGreaterThan(0);

      manager.unloadTriggers();

      expect(manager.getListenerIds().length).toBe(0);
      expect(manager.getTriggers().length).toBe(0);
    });

    it("should clear cooldowns", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          cooldownMs: 1000,
          conditions: [{ type: "click" }],
          actions: []
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});

      let status = manager.getCooldownStatus("trigger-1");
      expect(status.onCooldown).toBe(true);

      manager.unloadTriggers();

      status = manager.getCooldownStatus("trigger-1");
      expect(status.onCooldown).toBe(false);
    });

    it("should stop triggering events after unload", () => {
      const triggers = [
        {
          id: "trigger-1",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click" }],
          actions: [{ type: "playAnimation", animation: "jump" }]
        }
      ];

      manager.loadTriggers(triggers);
      eventBus.emit("click", {});
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1);

      manager.unloadTriggers();
      eventBus.emit("click", {});
      expect(actionExecutors.playAnimation).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});
