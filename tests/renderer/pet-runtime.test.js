import { describe, expect, it, vi } from "vitest";
import {
  buildRuntimeModel,
  createRuleRuntime,
  executeRuntimeAction
} from "../../src/renderer/pet/pet-runtime";

describe("pet runtime model", () => {
  it("uses package state assets when manifest asset URLs are present", () => {
    const model = buildRuntimeModel({
      config: {},
      activePackage: {
        manifest: {
          states: {
            idle: [{ id: "idle", asset: "assets/idle.svg" }],
            click: [{ id: "click", asset: "assets/click.svg" }]
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
  });

  it("uses saved config state bindings before package manifest state assets", () => {
    const model = buildRuntimeModel({
      config: {
        states: {
          idle: [{ id: "idle-custom", asset: "assets/custom-idle.svg" }]
        }
      },
      activePackage: {
        manifest: {
          states: {
            idle: [{ id: "idle-package", asset: "assets/package-idle.svg" }]
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

  it("evaluates legacy trigger rules and AND windows through the shared rule engine", () => {
    const runtime = createRuleRuntime({
      rules: [
        {
          id: "legacy-click",
          trigger: "click",
          filters: [{ field: "isInsidePet", operator: "=", value: true }],
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
      "legacy-click": 1000,
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

    executeRuntimeAction({ id: "anim", type: "playAnimation", assetUrl: "file:///wave.svg", durationMs: 900 }, effects);
    executeRuntimeAction({ id: "message", type: "randomMessage", messages: ["one"], durationMs: 700 }, effects);
    executeRuntimeAction({ id: "scale", type: "changeScale", scale: 1.4 }, effects);
    executeRuntimeAction({ id: "opacity", type: "changeOpacity", opacity: 0.6 }, effects);
    executeRuntimeAction({ id: "hide", type: "hidePet" }, effects);
    executeRuntimeAction({ id: "show", type: "showPet" }, effects);
    executeRuntimeAction({ id: "reset", type: "resetPosition" }, effects);
    executeRuntimeAction({ id: "panel", type: "openPanel" }, effects);

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
});
