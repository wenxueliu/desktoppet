import { describe, expect, it } from "vitest";
import manifestValidator from "../../src/shared/manifest-validator";

const { validateManifest } = manifestValidator;

describe("validateManifest", () => {
  it("accepts a valid manifest with actions and trigger filters", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "cute-dog-001",
      name: "Cute Dog",
      version: "1.0.0",
      states: {
        idle: [{ id: "idle", asset: "assets/idle.webm", loop: true }]
      },
      actions: [
        { id: "wave", name: "Wave", type: "playAnimation", asset: "assets/wave.webm" }
      ],
      triggers: [
        {
          id: "approach",
          name: "Approach",
          enabled: true,
          relation: "single",
          conditions: [
            {
              type: "mouseMove",
              filters: [
                { field: "distanceToPetBounds", operator: "<=", value: 80, unit: "px" }
              ]
            }
          ],
          actions: ["wave"]
        }
      ]
    }, new Set(["assets/idle.webm", "assets/wave.webm"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects missing idle state", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "bad",
      name: "Bad",
      version: "1.0.0",
      states: {}
    }, new Set());

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("states.idle is required");
  });

  it("rejects unsupported trigger filter fields", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "bad-filter",
      name: "Bad Filter",
      version: "1.0.0",
      states: {
        idle: [{ id: "idle", asset: "assets/idle.webm", loop: true }]
      },
      actions: [{ id: "wave", name: "Wave", type: "playAnimation", asset: "assets/wave.webm" }],
      triggers: [
        {
          id: "bad-rule",
          name: "Bad Rule",
          relation: "single",
          conditions: [{ type: "mouseMove", filters: [{ field: "unknown", operator: "=", value: true }] }],
          actions: ["wave"]
        }
      ]
    }, new Set(["assets/idle.webm", "assets/wave.webm"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("triggers[0].conditions[0].filters[0].field is not supported for mouseMove");
  });

  it("rejects trigger actions that reference missing action ids", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "missing-action",
      name: "Missing Action",
      version: "1.0.0",
      states: {
        idle: [{ id: "idle", asset: "assets/idle.webm", loop: true }]
      },
      actions: [{ id: "wave", name: "Wave", type: "playAnimation", asset: "assets/wave.webm" }],
      triggers: [
        {
          id: "bad-action-reference",
          name: "Bad Action Reference",
          relation: "single",
          conditions: ["click"],
          actions: ["missing-wave"]
        }
      ]
    }, new Set(["assets/idle.webm", "assets/wave.webm"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("triggers[0].actions references missing action: missing-wave");
  });

  it("rejects missing preview files when available files are provided", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "missing-preview",
      name: "Missing Preview",
      version: "1.0.0",
      preview: "preview.png",
      states: {
        idle: [{ id: "idle", asset: "assets/idle.webm", loop: true }]
      }
    }, new Set(["assets/idle.webm"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("asset not found: preview.png");
  });

  it("rejects action state targets that do not match state keys or state ids", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "bad-state-target",
      name: "Bad State Target",
      version: "1.0.0",
      states: {
        idle: [{ id: "idle-default", asset: "assets/idle.webm", loop: true }]
      },
      actions: [
        {
          id: "wave",
          name: "Wave",
          type: "playAnimation",
          asset: "assets/wave.webm",
          returnToState: "missing-state"
        },
        {
          id: "sleep",
          name: "Sleep",
          type: "switchState",
          state: "missing-state-entry"
        }
      ]
    }, new Set(["assets/idle.webm", "assets/wave.webm"]));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("actions[0].returnToState references missing state: missing-state");
    expect(result.errors).toContain("actions[1].state references missing state: missing-state-entry");
  });

  it("rejects unsafe asset paths even without available files", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "unsafe-assets",
      name: "Unsafe Assets",
      version: "1.0.0",
      preview: "/tmp/preview.png",
      states: {
        idle: [
          { id: "idle-default", asset: "../idle.webm", loop: true },
          { id: "idle-empty-segment", asset: "assets//idle.webm", loop: true }
        ]
      },
      actions: [
        { id: "wave", name: "Wave", type: "playAnimation", asset: "assets\\..\\wave.webm" }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("asset path is unsafe: /tmp/preview.png");
    expect(result.errors).toContain("asset path is unsafe: ../idle.webm");
    expect(result.errors).toContain("asset path is unsafe: assets//idle.webm");
    expect(result.errors).toContain("asset path is unsafe: assets\\..\\wave.webm");
  });

  it("accepts action state targets matching a state key or a state entry id", () => {
    const result = validateManifest({
      schemaVersion: "1.0.0",
      packageId: "valid-state-targets",
      name: "Valid State Targets",
      version: "1.0.0",
      states: {
        idle: [{ id: "idle-default", asset: "assets/idle.webm", loop: true }],
        sleep: [{ id: "sleep-default", asset: "assets/sleep.webm", loop: true }]
      },
      actions: [
        {
          id: "wave",
          name: "Wave",
          type: "playAnimation",
          asset: "assets/wave.webm",
          returnToState: "idle"
        },
        {
          id: "sleep",
          name: "Sleep",
          type: "switchState",
          state: "sleep-default"
        }
      ]
    }, new Set(["assets/idle.webm", "assets/sleep.webm", "assets/wave.webm"]));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
