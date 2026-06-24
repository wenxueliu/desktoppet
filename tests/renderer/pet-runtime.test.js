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
      setHidden: vi.fn(),
      resetPosition: vi.fn(),
      openPanel: vi.fn()
    };

    const clipById = new Map([
      ["anim", { id: "anim", type: "oneshot", durationMs: 900 }]
    ]);

    executeRuntimeAction({ id: "anim", type: "playAnimation", animation: "anim", assetUrl: "file:///wave.svg", durationMs: 900 }, effects, clipById);
    executeRuntimeAction({ id: "message", type: "randomMessage", messages: ["one"], durationMs: 700 }, effects, clipById);
    executeRuntimeAction({ id: "scale", type: "changeScale", scale: 1.4 }, effects, clipById);
    executeRuntimeAction({ id: "opacity", type: "changeOpacity", opacity: 0.6 }, effects, clipById);
    executeRuntimeAction({ id: "hide", type: "hidePet" }, effects, clipById);
    executeRuntimeAction({ id: "show", type: "showPet" }, effects, clipById);
    executeRuntimeAction({ id: "reset", type: "resetPosition" }, effects, clipById);
    executeRuntimeAction({ id: "panel", type: "openPanel" }, effects, clipById);

    expect(effects.playState).toHaveBeenCalledWith("anim", "file:///wave.svg");
    expect(effects.showMessage).toHaveBeenCalledWith("one", 700);
    expect(effects.applyDisplayPatch).toHaveBeenCalledWith({ scale: 1.4 });
    expect(effects.applyDisplayPatch).toHaveBeenCalledWith({ opacity: 0.6 });
    expect(effects.setHidden).toHaveBeenCalledWith(true);
    expect(effects.setHidden).toHaveBeenCalledWith(false);
    expect(effects.resetPosition).toHaveBeenCalledOnce();
    expect(effects.openPanel).toHaveBeenCalledOnce();
    expect(effects.scheduleIdle).toHaveBeenCalledWith(900, undefined);
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
    expect(effects.playState).toHaveBeenCalledWith("loop-anim", undefined);
    expect(effects.scheduleIdle).not.toHaveBeenCalled();

    effects.scheduleIdle.mockClear();
    effects.playState.mockClear();

    // Oneshot animation SHOULD call scheduleIdle
    executeRuntimeAction({ type: "playAnimation", animation: "oneshot-anim", durationMs: 900 }, effects, clipById);
    expect(effects.playState).toHaveBeenCalledWith("oneshot-anim", undefined);
    expect(effects.scheduleIdle).toHaveBeenCalledWith(900, undefined);
  });
});
