import { describe, expect, it } from "vitest";
import {
  FIELD_INPUT_TYPES,
  TRIGGER_PARAMETER_FIELDS,
  buildActionFromForm,
  buildRuleFromForm,
  updateConfigAction,
  updateConfigDisplay,
  updateConfigRule
} from "../../src/renderer/panel/panel-state";
import schema from "../../src/shared/schema";

describe("panel state helpers", () => {
  it("updates display settings without dropping existing config fields", () => {
    const config = {
      currentPackageId: "default-pet",
      display: { x: 10, y: 20, scale: 1, opacity: 1, alwaysOnTop: true },
      system: { language: "zh-CN" },
      customActions: [{ id: "wave" }],
      triggerRules: [{ id: "on-click" }]
    };

    const nextConfig = updateConfigDisplay(config, {
      scale: 1.25,
      opacity: 0.8,
      alwaysOnTop: false,
      mousePassthrough: true,
      showHoverButtons: false
    });

    expect(nextConfig).toEqual({
      ...config,
      display: {
        x: 10,
        y: 20,
        scale: 1.25,
        opacity: 0.8,
        alwaysOnTop: false,
        mousePassthrough: true,
        showHoverButtons: false
      }
    });
    expect(nextConfig).not.toBe(config);
    expect(nextConfig.display).not.toBe(config.display);
  });

  it("builds and upserts custom action arrays", () => {
    const action = buildActionFromForm({
      id: "action-1",
      name: "Wave",
      type: "playAnimation",
      assetPath: "assets/wave.svg",
      loop: true,
      returnToState: "idle",
      message: "Hello",
      durationMs: "1200",
      weight: "3"
    });

    expect(action).toEqual({
      id: "action-1",
      name: "Wave",
      type: "playAnimation",
      assetPath: "assets/wave.svg",
      loop: true,
      returnToState: "idle",
      message: "Hello",
      durationMs: 1200,
      weight: 3
    });

    const nextConfig = updateConfigAction({ customActions: [{ id: "old", name: "Old" }] }, action);
    expect(nextConfig.customActions).toEqual([{ id: "old", name: "Old" }, action]);

    const editedConfig = updateConfigAction(nextConfig, { ...action, name: "Wave edited" });
    expect(editedConfig.customActions).toEqual([{ id: "old", name: "Old" }, { ...action, name: "Wave edited" }]);
  });

  it("builds trigger rules with condition filters and action ids", () => {
    const rule = buildRuleFromForm({
      id: "rule-1",
      name: "Fast approach",
      enabled: true,
      relation: "and",
      windowMs: "2500",
      cooldownMs: "800",
      priority: "42",
      conditionType: "mouseMove",
      filterField: "speed",
      filterOperator: ">",
      filterValue: "100",
      filterUnit: "px/s",
      actionStrategy: "random",
      actionIds: "wave, jump"
    });

    expect(rule).toEqual({
      id: "rule-1",
      name: "Fast approach",
      enabled: true,
      relation: "and",
      windowMs: 2500,
      cooldownMs: 800,
      priority: 42,
      conditions: [
        {
          type: "mouseMove",
          filters: [{ field: "speed", operator: ">", value: 100, unit: "px/s" }]
        }
      ],
      actionStrategy: "random",
      actions: ["wave", "jump"]
    });

    const nextConfig = updateConfigRule({}, rule);
    expect(nextConfig.triggerRules).toEqual([rule]);
  });

  it("describes expected input controls for trigger fields", () => {
    expect(FIELD_INPUT_TYPES).toMatchObject({
      isInsidePet: "boolean",
      isMovingTowardPet: "boolean",
      distanceToPetCenter: "number",
      distanceToPetBounds: "number",
      speed: "number",
      direction: "select",
      dragDistance: "number",
      dragDurationMs: "number"
    });
  });

  it("keeps the panel trigger browser aligned with the shared schema", () => {
    expect(TRIGGER_PARAMETER_FIELDS).toEqual(schema.TRIGGER_PARAMETER_FIELDS);
  });
});
