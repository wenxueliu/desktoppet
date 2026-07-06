import { describe, expect, it } from "vitest";
import manifestValidator from "../../src/shared/manifest-validator";

const { validateManifest } = manifestValidator;
const IDLE_ID = "10000000-0000-4000-8000-000000000001";
const WAVE_ID = "10000000-0000-4000-8000-000000000002";

function createManifest(overrides = {}) {
  return {
    schemaVersion: "2.0.0",
    packageId: "animated-pet",
    name: "Animated Pet",
    version: "1.0.0",
    animations: {
      default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.svg" },
      clips: [
        { id: WAVE_ID, name: "Wave", type: "oneshot", asset: "assets/wave.svg", durationMs: 900 }
      ]
    },
    triggerRules: [
      {
        id: "wave-on-click",
        name: "Wave on click",
        relation: "single",
        conditions: ["click"],
        actions: [{ type: "playAnimation", animation: WAVE_ID, durationMs: 900 }]
      }
    ],
    ...overrides
  };
}

describe("validateManifest", () => {
  it("accepts a new-architecture manifest with animations and inline trigger actions", () => {
    const result = validateManifest(createManifest(), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts keyframe animations driven by keyframe progress actions", () => {
    const result = validateManifest(createManifest({
      animations: {
        default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.svg" },
        clips: [
          { id: WAVE_ID, name: "Look", type: "keyframe", asset: "assets/look.mp4" }
        ]
      },
      triggerRules: [
        {
          id: "look-at-mouse",
          name: "Look at mouse",
          relation: "single",
          continuous: true,
          conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetBounds", operator: "<=", value: 120 }] }],
          actions: [{ type: "setKeyframeProgress", animation: WAVE_ID, progressFrom: "angleToPetProgress" }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/look.mp4"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts valid green screen animation settings", () => {
    const result = validateManifest(createManifest({
      animations: {
        default: {
          id: IDLE_ID,
          name: "Idle",
          asset: "assets/idle.mp4",
          greenScreen: { enabled: true, color: "#00ff00", tolerance: 0.35, softness: 0.08 }
        },
        clips: [
          {
            id: WAVE_ID,
            name: "Wave",
            type: "loop",
            asset: "assets/wave.mp4",
            greenScreen: { enabled: true, color: "#11ff22", tolerance: 0.4, softness: 0.12 }
          }
        ]
      }
    }), new Set(["assets/idle.mp4", "assets/wave.mp4"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects invalid green screen animation settings", () => {
    const result = validateManifest(createManifest({
      animations: {
        default: {
          id: IDLE_ID,
          name: "Idle",
          asset: "assets/idle.mp4",
          greenScreen: { enabled: "yes", color: "green", tolerance: 2, softness: -0.1 }
        },
        clips: [
          {
            id: WAVE_ID,
            name: "Wave",
            type: "loop",
            asset: "assets/wave.mp4",
            greenScreen: "enabled"
          }
        ]
      }
    }), new Set(["assets/idle.mp4", "assets/wave.mp4"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("animations.default.greenScreen.enabled must be a boolean");
    expect(result.errors).toContain("animations.default.greenScreen.color must be a #RRGGBB color");
    expect(result.errors).toContain("animations.default.greenScreen.tolerance must be a number between 0 and 1");
    expect(result.errors).toContain("animations.default.greenScreen.softness must be a number between 0 and 1");
    expect(result.errors).toContain("animations.clips[0].greenScreen must be an object");
  });

  it("accepts mouseStill rules with duration filters", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "nap-when-mouse-still",
          relation: "single",
          conditions: [{ type: "mouseStill", filters: [{ field: "durationMs", operator: ">=", value: 3000 }] }],
          actions: [{ type: "playAnimation", animation: WAVE_ID, durationMs: 900 }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("requires an animation default clip", () => {
    const result = validateManifest(createManifest({
      animations: { clips: [] }
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("animations.default must be an object");
  });

  it("rejects missing package files referenced by animations", () => {
    const result = validateManifest(createManifest(), new Set(["assets/idle.svg"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("asset not found: assets/wave.svg");
  });

  it("rejects unsafe animation asset paths", () => {
    const result = validateManifest(createManifest({
      preview: "/tmp/preview.png",
      animations: {
        default: { id: IDLE_ID, name: "Idle", asset: "../idle.svg" },
        clips: [{ id: WAVE_ID, name: "Wave", type: "oneshot", asset: "assets//wave.svg" }]
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("asset path is unsafe: /tmp/preview.png");
    expect(result.errors).toContain("asset path is unsafe: ../idle.svg");
    expect(result.errors).toContain("asset path is unsafe: assets//wave.svg");
  });

  it("rejects unsupported trigger filter fields", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "bad-filter",
          relation: "single",
          conditions: [{ type: "mouseMove", filters: [{ field: "unknown", operator: "=", value: true }] }],
          actions: []
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("triggerRules[0].conditions[0].filters[0].field is not supported for mouseMove");
  });

  it("rejects non-boolean stopOnMatch values", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "bad-stop-on-match",
          relation: "single",
          stopOnMatch: "false",
          conditions: ["click"],
          actions: [{ type: "playAnimation", animation: WAVE_ID }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("triggerRules[0].stopOnMatch must be a boolean");
  });

  it("rejects inline actions that reference missing animations", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "bad-action",
          relation: "single",
          conditions: ["click"],
          actions: [{ type: "playAnimation", animation: "missing" }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("triggerRules[0].actions[0].animation references missing animation: missing");
  });

  it("accepts blank inline actions with duration", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "wait-action",
          relation: "single",
          conditions: ["click"],
          actions: [{ type: "blank", durationMs: 1200 }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(true);
  });

  it("accepts pomodoro timer actions and completion conditions", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "start-focus",
          relation: "single",
          conditions: ["click"],
          actions: [{ type: "pomodoroTimer", command: "start", durationMs: 1500000, label: "Focus" }]
        },
        {
          id: "focus-complete",
          relation: "single",
          conditions: [{ type: "pomodoroComplete", filters: [{ field: "label", operator: "=", value: "Focus" }] }],
          actions: [{ type: "showMessage", text: "Focus done", durationMs: 1800 }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts interaction toggle actions", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "disable-on-click",
          relation: "single",
          conditions: ["click"],
          actions: [{ type: "disableInteractions" }]
        },
        {
          id: "enable-on-timer",
          relation: "single",
          conditions: [{ type: "timer", filters: [{ field: "intervalMs", operator: ">=", value: 1000 }] }],
          actions: [{ type: "enableInteractions" }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects inline actions with direct asset fields", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "raw-asset",
          relation: "single",
          conditions: ["click"],
          actions: [{ type: "playAnimation", animation: WAVE_ID, assetUrl: "file:///unsafe.svg" }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("triggerRules[0].actions[0] cannot reference assets directly");
  });
});
