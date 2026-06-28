import { describe, expect, it, vi } from "vitest";
import {
  buildRuntimeModel,
  createRuleRuntime,
  executeRuntimeAction
} from "../../src/renderer/pet/pet-runtime";
import defaultsModule from "../../src/shared/defaults";

const { DEFAULT_CONFIG } = defaultsModule;

describe("pet runtime model", () => {
  it("uses package animation assets when manifest asset URLs are present", () => {
    const model = buildRuntimeModel({
      config: {},
      activePackage: {
        manifest: {
          animations: {
            default: { id: "idle", asset: "assets/idle.svg" },
            clips: [{ id: "click", asset: "assets/click.svg", type: "oneshot" }]
          }
        },
        assetsByPath: {
          "assets/idle.svg": "file:///pet/assets/idle.svg",
          "assets/click.svg": "file:///pet/assets/click.svg"
        }
      },
      defaultAssets: {
        idle: "default-idle.svg",
        click: "default-click.svg",
        drag: "default-drag.svg"
      }
    });

    expect(model.spriteAssets).toMatchObject({
      idle: "file:///pet/assets/idle.svg",
      click: "file:///pet/assets/click.svg",
      drag: "default-drag.svg"
    });
    expect(model.animationConfig.default.asset).toBe("file:///pet/assets/idle.svg");
  });

  it("uses saved config animation bindings before package manifest animation assets", () => {
    const model = buildRuntimeModel({
      config: {
        animations: {
          default: { id: "idle", asset: "assets/custom-idle.svg" },
          clips: []
        }
      },
      activePackage: {
        manifest: {
          animations: {
            default: { id: "idle", asset: "assets/package-idle.svg" },
            clips: []
          }
        },
        assetsByPath: {
          "assets/custom-idle.svg": "file:///pet/assets/custom-idle.svg",
          "assets/package-idle.svg": "file:///pet/assets/package-idle.svg"
        }
      },
      defaultAssets: {
        idle: "default-idle.svg",
        click: "default-click.svg",
        drag: "default-drag.svg"
      }
    });

    expect(model.spriteAssets.idle).toBe("file:///pet/assets/custom-idle.svg");
  });

  it("falls back to bundled assets when saved animation paths are not resolved package URLs", () => {
    const model = buildRuntimeModel({
      config: {
        animations: {
          default: { id: "idle-id", asset: "assets/idle.svg" },
          clips: [
            { id: "click-id", asset: "assets/click.svg", type: "oneshot" },
            { id: "drag-id", asset: "assets/drag.svg", type: "loop" }
          ]
        }
      },
      activePackage: null,
      defaultAssets: {
        idle: "default-idle.svg",
        click: "default-click.svg",
        drag: "default-drag.svg"
      }
    });

    expect(model.spriteAssets).toEqual({
      idle: "default-idle.svg",
      click: "default-click.svg",
      drag: "default-drag.svg"
    });
    expect(model.animationConfig.default.asset).toBe("default-idle.svg");
    expect(model.animationConfig.clips.map((clip) => clip.asset)).toEqual([
      "default-click.svg",
      "default-drag.svg"
    ]);
  });

  it("evaluates saved click rules and executes the selected actions", () => {
    const runtime = createRuleRuntime({
      rules: [
        {
          id: "click-wave",
          relation: "single",
          conditions: [{ type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }],
          actions: [{ type: "showMessage", text: "hello", durationMs: 1800 }]
        }
      ],
      now: () => 1000
    });

    const actions = runtime.evaluateEvent({ type: "click", timestamp: 1000, isInsidePet: true });

    expect(actions).toEqual([{ type: "showMessage", text: "hello", durationMs: 1800 }]);
    expect(runtime.getLastTriggeredAtByRuleId()).toEqual({ "click-wave": 1000 });
  });

  it("opens the panel through the default right-click trigger rule", () => {
    const rightClickRule = DEFAULT_CONFIG.triggerRules.find((rule) => rule.id === "default-right-click-panel");
    const runtime = createRuleRuntime({
      rules: DEFAULT_CONFIG.triggerRules,
      now: () => 1000
    });

    expect(rightClickRule).toMatchObject({
      enabled: true,
      conditions: [{ type: "rightClick", filters: [{ field: "isInsidePet", operator: "=", value: true }] }],
      actions: [{ type: "openPanel" }]
    });
    expect(runtime.evaluateEvent({ type: "rightClick", timestamp: 1000, isInsidePet: true })).toEqual([
      { type: "openPanel" }
    ]);
    expect(runtime.evaluateEvent({ type: "rightClick", timestamp: 1600, isInsidePet: false })).toEqual([]);
  });

  it("evaluates trigger filters and AND windows through the shared rule engine", () => {
    const runtime = createRuleRuntime({
      rules: [
        {
          id: "filtered-click",
          conditions: [{ type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }],
          cooldownMs: 500,
          priority: 1,
          actions: [{ type: "showMessage", text: "hello", durationMs: 1800 }]
        },
        {
          id: "enter-then-click",
          relation: "and",
          andWindowMs: 3000,
          priority: 5,
          conditions: ["mouseEnter", "click"],
          actions: [{ type: "showMessage", text: "combo", durationMs: 1800 }]
        }
      ],
      now: () => 1000
    });

    expect(runtime.evaluateEvent({ type: "click", timestamp: 1000, isInsidePet: true })).toEqual([
      { type: "showMessage", text: "hello", durationMs: 1800 }
    ]);
    expect(runtime.evaluateEvent({ type: "mouseEnter", timestamp: 2000 })).toEqual([]);
    expect(runtime.evaluateEvent({ type: "click", timestamp: 4500, isInsidePet: true })).toEqual([
      { type: "showMessage", text: "combo", durationMs: 1800 }
    ]);
    expect(runtime.getLastTriggeredAtByRuleId()).toEqual({
      "filtered-click": 1000,
      "enter-then-click": 4500
    });
  });

  it("executes supported runtime actions through narrow effects", async () => {
    const effects = {
      playState: vi.fn(),
      showMessage: vi.fn(),
      scheduleIdle: vi.fn(),
      applyDisplayPatch: vi.fn(),
      setKeyframeProgress: vi.fn(() => true),
      setHidden: vi.fn(),
      resetPosition: vi.fn(),
      openPanel: vi.fn()
    };

    const clipById = new Map([
      ["anim", { id: "anim", type: "oneshot", durationMs: 900 }],
      ["look", { id: "look", type: "keyframe", asset: "file:///look.mp4" }]
    ]);

    executeRuntimeAction({ id: "anim", type: "playAnimation", animation: "anim", assetUrl: "file:///wave.svg", durationMs: 900 }, effects, clipById);
    executeRuntimeAction({ id: "message", type: "randomMessage", messages: ["one"], durationMs: 700 }, effects, clipById);
    executeRuntimeAction({ id: "scale", type: "changeScale", scale: 1.4 }, effects, clipById);
    executeRuntimeAction({ id: "opacity", type: "changeOpacity", opacity: 0.6 }, effects, clipById);
    executeRuntimeAction({ id: "hide", type: "hidePet" }, effects, clipById);
    executeRuntimeAction({ id: "show", type: "showPet" }, effects, clipById);
    executeRuntimeAction({ id: "reset", type: "resetPosition" }, effects, clipById);
    executeRuntimeAction({ id: "panel", type: "openPanel" }, effects, clipById);
    executeRuntimeAction({
      id: "look-progress",
      type: "setKeyframeProgress",
      animation: "look",
      progressFrom: "angleToPetProgress"
    }, effects, clipById, { eventSource: "globalMouse", angleToPetProgress: 0.625 });

    expect(effects.playState).toHaveBeenCalledWith("anim", "file:///wave.svg", { loop: false });
    expect(effects.showMessage).toHaveBeenCalledWith("one", 700);
    expect(effects.applyDisplayPatch).toHaveBeenCalledWith({ scale: 1.4 });
    expect(effects.applyDisplayPatch).toHaveBeenCalledWith({ opacity: 0.6 });
    expect(effects.setHidden).toHaveBeenCalledWith(true);
    expect(effects.setHidden).toHaveBeenCalledWith(false);
    expect(effects.resetPosition).toHaveBeenCalledOnce();
    expect(effects.openPanel).toHaveBeenCalledOnce();
    expect(effects.scheduleIdle).toHaveBeenCalledWith(900, undefined);
    expect(effects.setKeyframeProgress).toHaveBeenCalledWith("look", 0.625, expect.objectContaining({
      type: "setKeyframeProgress"
    }));
  });

  it("does not schedule idle return for loop animations", () => {
    const effects = {
      playState: vi.fn(),
      scheduleIdle: vi.fn()
    };

    const clipById = new Map([
      ["loop-anim", { id: "loop-anim", type: "loop" }],
      ["oneshot-anim", { id: "oneshot-anim", type: "oneshot", durationMs: 900 }]
    ]);

    // Loop animation should NOT call scheduleIdle
    executeRuntimeAction({ type: "playAnimation", animation: "loop-anim", durationMs: 900 }, effects, clipById);
    expect(effects.playState).toHaveBeenCalledWith("loop-anim", undefined, { loop: true });
    expect(effects.scheduleIdle).not.toHaveBeenCalled();

    effects.scheduleIdle.mockClear();
    effects.playState.mockClear();

    // Oneshot animation SHOULD call scheduleIdle
    executeRuntimeAction({ type: "playAnimation", animation: "oneshot-anim", durationMs: 900 }, effects, clipById);
    expect(effects.playState).toHaveBeenCalledWith("oneshot-anim", undefined, { loop: false });
    expect(effects.scheduleIdle).toHaveBeenCalledWith(900, undefined);
  });
});

it("maps keyframe progress through clip keyframe positions", () => {
  const effects = {
    setKeyframeProgress: vi.fn(() => true)
  };
  const clipById = new Map([
    ["look", { id: "look", type: "keyframe", asset: "file:///look.mp4", keyframes: [{ input: 0, output: 0.1 }, { input: 0.25, output: 0.4 }, { input: 0.5, output: 0.6 }, { input: 0.75, output: 0.9 }] }]
  ]);

  executeRuntimeAction({
    type: "setKeyframeProgress",
    animation: "look",
    progressFrom: "angleToPetProgress"
  }, effects, clipById, { eventSource: "globalMouse", angleToPetProgress: 0.25 });

  expect(effects.setKeyframeProgress).toHaveBeenCalledWith("look", 0.4, expect.any(Object));
});

it("only drives keyframe progress from global mouse events", () => {
  const effects = {
    playState: vi.fn(),
    setKeyframeProgress: vi.fn(() => true)
  };
  const clipById = new Map([
    ["look", { id: "look", type: "keyframe", asset: "file:///look.mp4" }]
  ]);

  expect(executeRuntimeAction({
    type: "setKeyframeProgress",
    animation: "look",
    progressFrom: "angleToPetProgress"
  }, effects, clipById, { eventSource: "petRenderer", angleToPetProgress: 0.25 })).toBe(false);
  expect(effects.setKeyframeProgress).not.toHaveBeenCalled();

  expect(executeRuntimeAction({
    type: "playAnimation",
    animation: "look",
    progressFrom: "angleToPetProgress"
  }, effects, clipById, { eventSource: "petRenderer", angleToPetProgress: 0.25 })).toBe(false);
  expect(effects.playState).not.toHaveBeenCalled();
});

describe("stateful (sustained) rules", () => {
  function nearRule({ sustainMs = 3000, exitAfterMs = 3000, exitActions, exitConditions, exitRelation, exitAndWindowMs } = {}) {
    const rule = {
      id: "near-greet",
      enabled: true,
      relation: "single",
      conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }], sustainMs }],
      actions: [{ type: "playAnimation", animation: "greet" }],
      state: { exitAfterMs }
    };
    if (exitActions) rule.state.exitActions = exitActions;
    if (exitConditions) rule.state.exitConditions = exitConditions;
    if (exitRelation) rule.state.exitRelation = exitRelation;
    if (exitAndWindowMs) rule.state.exitAndWindowMs = exitAndWindowMs;
    return rule;
  }

  function move(distance, timestamp) {
    return { type: "mouseMove", timestamp, distanceToPetCenter: distance };
  }

  it("does not trigger until the enter condition has held for sustainMs", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({ rules: [nearRule({ sustainMs: 3000 })], now: () => clock });

    // Condition true, but only for 1s so far — under threshold.
    expect(runtime.evaluateEvent(move(100, 1000))).toEqual([]);
    clock = 2000;
    expect(runtime.evaluateEvent(move(100, 2000))).toEqual([]);

    // Still under threshold at 3s-elapsed minus a hair.
    clock = 3999;
    expect(runtime.evaluateEvent(move(100, 3999))).toEqual([]);

    // At 3s sustained, it fires.
    clock = 4000;
    expect(runtime.evaluateEvent(move(100, 4000))).toEqual([
      { type: "playAnimation", animation: "greet" }
    ]);
  });

  it("resets the sustain timer when the condition briefly fails", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({ rules: [nearRule({ sustainMs: 3000 })], now: () => clock });

    // Hold for 2s (under threshold), then break the condition.
    runtime.evaluateEvent(move(100, 1000));
    clock = 3000;
    runtime.evaluateEvent(move(100, 3000));
    // Cursor moves away — condition fails, sustain timer resets.
    clock = 3200;
    expect(runtime.evaluateEvent(move(500, 3200))).toEqual([]);

    // Now hold again. Only 1s after the reset, so no trigger yet.
    clock = 4200;
    expect(runtime.evaluateEvent(move(100, 4200))).toEqual([]);
    // After 3s of continuous holding, it fires.
    clock = 7200;
    expect(runtime.evaluateEvent(move(100, 7200))).toEqual([
      { type: "playAnimation", animation: "greet" }
    ]);
  });

  it("runs exitActions after the condition fails for exitAfterMs", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [nearRule({
        sustainMs: 1000,
        exitAfterMs: 3000,
        exitActions: [{ type: "playAnimation", animation: "idle" }]
      })],
      now: () => clock
    });

    // Enter: hold 1s.
    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    expect(runtime.evaluateEvent(move(100, 2000))).toEqual([
      { type: "playAnimation", animation: "greet" }
    ]);
    const stateAfterEnter = runtime.getRuleState()["near-greet"];
    expect(stateAfterEnter.active).toBe(true);

    // Move away — fallback exit countdown begins because no explicit exit conditions are configured.
    clock = 2100;
    runtime.evaluateEvent(move(500, 2100));
    // Only 2s since inactive — no exit yet.
    clock = 4000;
    expect(runtime.evaluateEvent(move(500, 4000))).toEqual([]);

    // 3s after becoming inactive — exit fires.
    clock = 5100;
    expect(runtime.evaluateEvent(move(500, 5100))).toEqual([
      { type: "playAnimation", animation: "idle" }
    ]);
    const stateAfterExit = runtime.getRuleState()["near-greet"];
    expect(stateAfterExit.active).toBe(false);
  });

  it("runs exitActions after explicit exit conditions match for exitAfterMs", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [nearRule({
        sustainMs: 1000,
        exitAfterMs: 3000,
        exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">=", value: 300 }], sustainMs: 3000 }],
        exitActions: [{ type: "playAnimation", animation: "idle" }]
      })],
      now: () => clock
    });

    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    runtime.evaluateEvent(move(100, 2000));
    expect(runtime.getRuleState()["near-greet"].active).toBe(true);

    clock = 2500;
    runtime.evaluateEvent(move(500, 2500));
    clock = 5400;
    expect(runtime.evaluateEvent(move(500, 5400))).toEqual([]);
    clock = 5500;
    expect(runtime.evaluateEvent(move(500, 5500))).toEqual([
      { type: "playAnimation", animation: "idle" }
    ]);
  });

  it("supports OR exit conditions", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [nearRule({
        sustainMs: 1000,
        exitAfterMs: 1000,
        exitRelation: "or",
        exitConditions: [
          { type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">=", value: 300 }], sustainMs: 1000 },
          { type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }
        ],
        exitActions: [{ type: "playAnimation", animation: "idle" }]
      })],
      now: () => clock
    });

    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    runtime.evaluateEvent(move(100, 2000));

    clock = 2500;
    runtime.evaluateEvent({ type: "click", timestamp: 2500, isInsidePet: true });
    clock = 3500;
    expect(runtime.evaluateEvent({ type: "click", timestamp: 3500, isInsidePet: true })).toEqual([
      { type: "playAnimation", animation: "idle" }
    ]);
  });

  it("supports AND exit conditions within the exit time window", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [nearRule({
        sustainMs: 1000,
        exitAfterMs: 1000,
        exitRelation: "and",
        exitAndWindowMs: 2000,
        exitConditions: [
          { type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">=", value: 300 }], sustainMs: 1000 },
          { type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }
        ],
        exitActions: [{ type: "playAnimation", animation: "idle" }]
      })],
      now: () => clock
    });

    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    runtime.evaluateEvent(move(100, 2000));

    clock = 2500;
    runtime.evaluateEvent(move(500, 2500));
    clock = 2600;
    runtime.evaluateEvent({ type: "click", timestamp: 2600, isInsidePet: true });
    clock = 3600;
    expect(runtime.evaluateEvent({ type: "click", timestamp: 3600, isInsidePet: true })).toEqual([
      { type: "playAnimation", animation: "idle" }
    ]);
  });

  it("resets explicit exit timing when exit conditions stop matching", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [nearRule({
        sustainMs: 1000,
        exitAfterMs: 3000,
        exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">=", value: 300 }], sustainMs: 3000 }],
        exitActions: [{ type: "playAnimation", animation: "idle" }]
      })],
      now: () => clock
    });

    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    runtime.evaluateEvent(move(100, 2000));

    // Start exit timing, then return before it reaches 3s.
    clock = 2500;
    runtime.evaluateEvent(move(500, 2500));
    clock = 4000;
    runtime.evaluateEvent(move(100, 4000));

    // Exit timing restarts from 4500, so 7000 is still under threshold.
    clock = 4500;
    runtime.evaluateEvent(move(500, 4500));
    clock = 7000;
    expect(runtime.evaluateEvent(move(500, 7000))).toEqual([]);
    clock = 7500;
    expect(runtime.evaluateEvent(move(500, 7500))).toEqual([
      { type: "playAnimation", animation: "idle" }
    ]);
  });

  it("defaults to stopAnimation when exitActions is not configured", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [nearRule({ sustainMs: 1000, exitAfterMs: 1000 })],
      now: () => clock
    });

    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    runtime.evaluateEvent(move(100, 2000));

    // Break condition and wait past exitAfterMs.
    clock = 2100;
    runtime.evaluateEvent(move(500, 2100));
    clock = 3200;
    expect(runtime.evaluateEvent(move(500, 3200))).toEqual([{ type: "stopAnimation" }]);
  });

  it("suppresses competing non-stateful rules while a stateful rule is active", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [
        nearRule({ sustainMs: 1000, exitAfterMs: 5000 }),
        {
          id: "click-wave",
          enabled: true,
          relation: "single",
          priority: 10,
          conditions: [{ type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }],
          actions: [{ type: "playAnimation", animation: "wave" }]
        }
      ],
      now: () => clock
    });

    // Activate the stateful rule.
    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    runtime.evaluateEvent(move(100, 2000));
    expect(runtime.getRuleState()["near-greet"].active).toBe(true);

    // While active, a click (even higher priority) is suppressed.
    clock = 2500;
    expect(runtime.evaluateEvent({ type: "click", timestamp: 2500, isInsidePet: true })).toEqual([]);
  });

  it("does not reset mouseMove enter sustain timing on unrelated timer events", () => {
    vi.useFakeTimers();
    let clock = 1000;
    const onTimerActions = vi.fn();
    const runtime = createRuleRuntime({
      rules: [{
        id: "sustained-scrub",
        enabled: true,
        relation: "single",
        continuous: true,
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }], sustainMs: 3000 }],
        actions: [{ type: "setKeyframeProgress", animation: "look", progressFrom: "angleToPetProgress" }],
        state: {
          exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">", value: 400 }], sustainMs: 5000 }],
          exitActions: [{ type: "playAnimation", animation: "idle" }]
        }
      }],
      now: () => clock,
      onTimerActions
    });

    try {
      runtime.evaluateEvent({
        ...move(100, 1000),
        eventSource: "globalMouse",
        angleToPetProgress: 0.25
      });
      clock = 2000;
      runtime.evaluateEvent({ type: "idleDuration", eventSource: "timer", timestamp: 2000, elapsedMs: 1000 });
      expect(runtime.getRuleState()["sustained-scrub"].conditionTrueSince).toBe(1000);

      clock = 4000;
      vi.advanceTimersByTime(3000);
      expect(onTimerActions).toHaveBeenCalledWith(
        [{ type: "setKeyframeProgress", animation: "look", progressFrom: "angleToPetProgress" }],
        expect.objectContaining({ ruleId: "sustained-scrub", stateTransition: "enter" })
      );
    } finally {
      runtime.destroy();
      vi.useRealTimers();
    }
  });

  it("does not reset active mouseMove exit timing on unrelated timer events", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [nearRule({
        sustainMs: 1000,
        exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">=", value: 300 }], sustainMs: 3000 }],
        exitActions: [{ type: "playAnimation", animation: "idle" }]
      })],
      now: () => clock
    });

    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    runtime.evaluateEvent(move(100, 2000));
    clock = 2500;
    runtime.evaluateEvent(move(500, 2500));
    clock = 3000;
    runtime.evaluateEvent({ type: "idleDuration", eventSource: "timer", timestamp: 3000, elapsedMs: 1000 });
    expect(runtime.getRuleState()["near-greet"].exitTrueSince).toBe(2500);

    clock = 5500;
    expect(runtime.evaluateEvent(move(500, 5500))).toEqual([
      { type: "playAnimation", animation: "idle" }
    ]);
  });

  it("ignores pet-renderer mouseMove for keyframe state rules so global mouse can trigger them", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [{
        id: "global-keyframe",
        enabled: true,
        relation: "single",
        continuous: true,
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }] }],
        actions: [{ type: "setKeyframeProgress", animation: "look", progressFrom: "angleToPetProgress" }],
        state: {
          exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">", value: 400 }], sustainMs: 1000 }],
          exitActions: [{ type: "playAnimation", animation: "idle" }]
        }
      }],
      now: () => clock
    });

    // Local renderer mousemove has no angleToPetProgress and must not enter the
    // keyframe state, otherwise the later global mouse event would be ignored or
    // its action would be blocked by the action executor.
    expect(runtime.evaluateEvent({ ...move(100, 1000), eventSource: "petRenderer" })).toEqual([]);
    expect(runtime.getRuleState()["global-keyframe"]).toBeUndefined();

    clock = 1100;
    expect(runtime.evaluateEvent({
      ...move(100, 1100),
      eventSource: "globalMouse",
      angleToPetProgress: 0.25
    })).toEqual([
      { type: "setKeyframeProgress", animation: "look", progressFrom: "angleToPetProgress" }
    ]);
    expect(runtime.getRuleState()["global-keyframe"].active).toBe(true);
  });

  it("enters sustained mouseMove state from the timer when the cursor stops moving", () => {
    vi.useFakeTimers();
    let clock = 1000;
    const onTimerActions = vi.fn();
    const runtime = createRuleRuntime({
      rules: [{
        id: "sustained-scrub",
        enabled: true,
        relation: "single",
        continuous: true,
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }], sustainMs: 3000 }],
        actions: [{ type: "setKeyframeProgress", animation: "look", progressFrom: "angleToPetProgress" }],
        state: {
          exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">", value: 400 }], sustainMs: 5000 }],
          exitActions: [{ type: "playAnimation", animation: "idle" }]
        }
      }],
      now: () => clock,
      onTimerActions
    });

    try {
      expect(runtime.evaluateEvent({
        ...move(100, 1000),
        eventSource: "globalMouse",
        angleToPetProgress: 0.25
      })).toEqual([]);

      clock = 4000;
      vi.advanceTimersByTime(3000);

      expect(onTimerActions).toHaveBeenCalledWith(
        [{ type: "setKeyframeProgress", animation: "look", progressFrom: "angleToPetProgress" }],
        expect.objectContaining({
          eventSource: "globalMouse",
          angleToPetProgress: 0.25,
          stateTransition: "enter",
          ruleId: "sustained-scrub",
          timestamp: 4000
        })
      );
      expect(runtime.getRuleState()["sustained-scrub"].active).toBe(true);
    } finally {
      runtime.destroy();
      vi.useRealTimers();
    }
  });

  it("re-emits continuous keyframe actions on every matching mouseMove while active", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [{
        id: "instant-near",
        enabled: true,
        relation: "single",
        continuous: true,
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }] }],
        actions: [{ type: "setKeyframeProgress", animation: "look" }],
        state: {
          exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">", value: 400 }], sustainMs: 5000 }],
          exitActions: [{ type: "playAnimation", animation: "idle" }]
        }
      }],
      now: () => clock
    });

    // First matching event enters the state and emits the action once.
    expect(runtime.evaluateEvent({ ...move(100, 1000), eventSource: "globalMouse" })).toEqual([
      { type: "setKeyframeProgress", animation: "look" }
    ]);
    // Subsequent matching events re-emit the action so the keyframe clip
    // follows the cursor instead of freezing on the first frame.
    clock = 1500;
    expect(runtime.evaluateEvent({ ...move(120, 1500), eventSource: "globalMouse" })).toEqual([
      { type: "setKeyframeProgress", animation: "look" }
    ]);
    clock = 2000;
    expect(runtime.evaluateEvent({ ...move(80, 2000), eventSource: "globalMouse" })).toEqual([
      { type: "setKeyframeProgress", animation: "look" }
    ]);
  });

  it("does not re-emit actions for sustained (non-continuous) stateful rules after enter", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [{
        id: "sustained-near",
        enabled: true,
        relation: "single",
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }], sustainMs: 1000 }],
        actions: [{ type: "playAnimation", animation: "greet" }],
        state: {
          exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">=", value: 300 }], sustainMs: 1000 }],
          exitActions: [{ type: "playAnimation", animation: "idle" }]
        }
      }],
      now: () => clock
    });

    clock = 1000;
    runtime.evaluateEvent(move(100, 1000));
    clock = 2000;
    expect(runtime.evaluateEvent(move(100, 2000))).toEqual([
      { type: "playAnimation", animation: "greet" }
    ]);
    // Still matching while active — sustained rules fire only once on enter.
    clock = 3000;
    expect(runtime.evaluateEvent(move(100, 3000))).toEqual([]);
  });

  it("runs exitActions for mouseMove rules that have exit state but no enter sustainMs", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [{
        id: "instant-near",
        enabled: true,
        relation: "single",
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }] }],
        actions: [{ type: "setKeyframeProgress", animation: "look" }],
        state: {
          exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">", value: 400 }], sustainMs: 5000 }],
          exitActions: [{ type: "playAnimation", animation: "idle" }]
        }
      }],
      now: () => clock
    });

    expect(runtime.evaluateEvent({ ...move(100, 1000), eventSource: "globalMouse" })).toEqual([
      { type: "setKeyframeProgress", animation: "look" }
    ]);
    expect(runtime.getRuleState()["instant-near"].active).toBe(true);

    clock = 2000;
    expect(runtime.evaluateEvent({ ...move(500, 2000), eventSource: "globalMouse" })).toEqual([]);
    clock = 6999;
    expect(runtime.evaluateEvent({ ...move(500, 6999), eventSource: "globalMouse" })).toEqual([]);
    clock = 7000;
    expect(runtime.evaluateEvent({ ...move(500, 7000), eventSource: "globalMouse" })).toEqual([
      { type: "playAnimation", animation: "idle" }
    ]);
    expect(runtime.getRuleState()["instant-near"].active).toBe(false);
  });

  it("dispatches timer-driven exit actions through the runtime callback", () => {
    vi.useFakeTimers();
    let clock = 1000;
    const onTimerActions = vi.fn();
    const runtime = createRuleRuntime({
      rules: [nearRule({
        sustainMs: 1000,
        exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">=", value: 300 }], sustainMs: 1000 }],
        exitActions: [{ type: "playAnimation", animation: "idle" }]
      })],
      now: () => clock,
      onTimerActions
    });

    try {
      runtime.evaluateEvent(move(100, 1000));
      clock = 2000;
      runtime.evaluateEvent(move(100, 2000));
      clock = 2100;
      runtime.evaluateEvent(move(500, 2100));
      clock = 3100;
      vi.advanceTimersByTime(1000);

      expect(onTimerActions).toHaveBeenCalledWith(
        [{ type: "playAnimation", animation: "idle" }],
        expect.objectContaining({ type: "mouseMove", ruleId: "near-greet", stateTransition: "exit", timestamp: 3100 })
      );
      expect(runtime.evaluateEvent(move(500, 3200))).toEqual([]);
    } finally {
      runtime.destroy();
      vi.useRealTimers();
    }
  });

  it("leaves non-stateful rules unaffected when no state field is present", () => {
    let clock = 1000;
    const runtime = createRuleRuntime({
      rules: [
        {
          id: "plain-click",
          enabled: true,
          relation: "single",
          conditions: [{ type: "click", filters: [] }],
          actions: [{ type: "showMessage", text: "hi" }]
        }
      ],
      now: () => clock
    });

    expect(runtime.evaluateEvent({ type: "click", timestamp: 1000, isInsidePet: true })).toEqual([
      { type: "showMessage", text: "hi" }
    ]);
  });
});

