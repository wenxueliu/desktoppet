import { describe, expect, it } from "vitest";
import manifestValidator from "../../src/shared/manifest-validator";

const { validateManifest } = manifestValidator;

function createManifest(overrides = {}) {
  return {
    schemaVersion: "2.0.0",
    packageId: "animated-pet",
    name: "Animated Pet",
    version: "1.0.0",
    animations: {
      default: { id: "idle", asset: "assets/idle.svg" },
      clips: [
        { id: "wave", type: "oneshot", asset: "assets/wave.svg", durationMs: 900 }
      ]
    },
    triggerRules: [
      {
        id: "wave-on-click",
        name: "Wave on click",
        relation: "single",
        conditions: ["click"],
        actions: [{ type: "playAnimation", animation: "wave", durationMs: 900 }]
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
        default: { id: "idle", asset: "../idle.svg" },
        clips: [{ id: "wave", type: "oneshot", asset: "assets//wave.svg" }]
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

  it("rejects inline actions with direct asset fields", () => {
    const result = validateManifest(createManifest({
      triggerRules: [
        {
          id: "raw-asset",
          relation: "single",
          conditions: ["click"],
          actions: [{ type: "playAnimation", animation: "wave", assetUrl: "file:///unsafe.svg" }]
        }
      ]
    }), new Set(["assets/idle.svg", "assets/wave.svg"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("triggerRules[0].actions[0] cannot reference assets directly");
  });
});
