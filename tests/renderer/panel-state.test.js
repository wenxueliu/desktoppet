import { describe, expect, it } from "vitest";
import {
  BASIC_STATE_TYPES,
  FIELD_INPUT_TYPES,
  TRIGGER_PARAMETER_FIELDS,
  buildActionFromForm,
  buildRuleConditionFromForm,
  buildRuleFromForm,
  buildStateFromForm,
  deleteConfigAction,
  deleteConfigRule,
  getConfigStates,
  getPanelOverviewStats,
  getFieldsForCondition,
  updateConfigAction,
  updateConfigDisplay,
  updateConfigInteractions,
  removeConfigAssetReferences,
  updateConfigRule,
  updateConfigState,
  updateConfigSystem,
  validateRuleForm
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
      asset: "assets/wave.svg",
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
      asset: "assets/wave.svg",
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

  it("deletes custom actions and removes them from trigger rules", () => {
    const nextConfig = deleteConfigAction({
      customActions: [{ id: "wave" }, { id: "jump" }],
      triggerRules: [
        { id: "rule-1", actions: ["wave", "jump"] },
        { id: "rule-2", actions: ["wave"] }
      ]
    }, "wave");

    expect(nextConfig.customActions).toEqual([{ id: "jump" }]);
    expect(nextConfig.triggerRules).toEqual([
      { id: "rule-1", actions: ["jump"] },
      { id: "rule-2", actions: [] }
    ]);
  });

  it("normalizes built-in states and upserts state asset bindings", () => {
    expect(BASIC_STATE_TYPES.map((stateType) => stateType.id)).toEqual([
      "idle",
      "click",
      "drag",
      "hover",
      "random",
      "timed",
      "sleep"
    ]);

    const states = getConfigStates({
      states: {
        idle: [{ id: "idle-default", asset: "assets/idle.webm", loop: true }],
        click: { id: "legacy-click", asset: "assets/click.webm" }
      }
    });

    expect(states.idle).toEqual([{ id: "idle-default", asset: "assets/idle.webm", loop: true }]);
    expect(states.click).toEqual([{ id: "legacy-click", asset: "assets/click.webm" }]);
    expect(states.drag).toEqual([]);

    const stateEntry = buildStateFromForm({
      stateType: "drag",
      id: "drag-default",
      name: "Dragged",
      asset: "assets/drag.webm",
      message: "Moving!",
      loop: true,
      weight: "2",
      durationMs: "850",
      returnToState: "idle"
    });

    expect(stateEntry).toEqual({
      id: "drag-default",
      name: "Dragged",
      asset: "assets/drag.webm",
      message: "Moving!",
      loop: true,
      weight: 2,
      durationMs: 850,
      returnToState: "idle"
    });

    const nextConfig = updateConfigState({ states }, "drag", stateEntry);
    expect(nextConfig.states.drag).toEqual([stateEntry]);

    const editedConfig = updateConfigState(nextConfig, "drag", { ...stateEntry, asset: "assets/drag-2.webm" });
    expect(editedConfig.states.drag).toEqual([{ ...stateEntry, asset: "assets/drag-2.webm" }]);
  });

  it("removes asset references from states and actions", () => {
    const nextConfig = removeConfigAssetReferences({
      states: {
        idle: [{ id: "idle", asset: "assets/idle.svg" }],
        click: [{ id: "click", asset: "assets/click.svg" }]
      },
      customActions: [
        { id: "wave", asset: "assets/idle.svg" },
        { id: "jump", asset: "assets/jump.svg" }
      ]
    }, "assets/idle.svg");

    expect(nextConfig.states.idle).toEqual([{ id: "idle" }]);
    expect(nextConfig.states.click).toEqual([{ id: "click", asset: "assets/click.svg" }]);
    expect(nextConfig.customActions).toEqual([
      { id: "wave" },
      { id: "jump", asset: "assets/jump.svg" }
    ]);
  });

  it("summarizes overview counts from the current panel config", () => {
    const stats = getPanelOverviewStats({
      currentPackageId: "space-cat",
      states: {
        idle: [{ id: "idle", asset: "assets/idle.webm" }],
        click: [{ id: "click", asset: "assets/click.webm" }],
        drag: []
      },
      customActions: [
        { id: "wave", asset: "assets/wave.webm" },
        { id: "say", type: "showMessage" }
      ],
      triggerRules: [{ id: "on-click" }],
      display: { scale: 1.25 },
      system: { launchAtLogin: true }
    });

    expect(stats).toEqual({
      packageId: "space-cat",
      stateCount: 2,
      actionCount: 2,
      ruleCount: 1,
      assetCount: 3,
      displayScalePercent: 125,
      launchAtLogin: true
    });
  });

  it("updates system settings without leaving saved panel config stale", () => {
    const config = {
      currentPackageId: "default-pet",
      system: { language: "zh-CN", launchAtLogin: false },
      display: { scale: 1 }
    };

    const nextConfig = updateConfigSystem(config, { launchAtLogin: true });

    expect(nextConfig).toEqual({
      ...config,
      system: { language: "zh-CN", launchAtLogin: true }
    });
    expect(nextConfig).not.toBe(config);
    expect(nextConfig.system).not.toBe(config.system);
  });

  it("updates interaction messages and bubble settings without dropping defaults", () => {
    const nextConfig = updateConfigInteractions({
      interactions: {
        clickMessages: ["Hello"],
        randomMessages: ["Idle"],
        bubble: { maxWidth: 220, durationMs: 1800, showCloseButton: false }
      }
    }, {
      timedMessages: ["Time"],
      bubble: { maxWidth: 280 }
    });

    expect(nextConfig.interactions).toEqual({
      clickMessages: ["Hello"],
      randomMessages: ["Idle"],
      timedMessages: ["Time"],
      bubble: { maxWidth: 280, durationMs: 1800, showCloseButton: false }
    });
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
      actionIds: ["wave", "jump"]
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

  it("deletes trigger rules by id", () => {
    const nextConfig = deleteConfigRule({
      triggerRules: [{ id: "keep" }, { id: "delete-me" }]
    }, "delete-me");

    expect(nextConfig.triggerRules).toEqual([{ id: "keep" }]);
  });

  it("builds trigger rules with multiple conditions and per-condition filters", () => {
    const rule = buildRuleFromForm({
      id: "rule-2",
      name: "Enter then fast click",
      enabled: true,
      relation: "and",
      andWindowMs: "3500",
      cooldownMs: "900",
      priority: "7",
      conditions: [
        {
          type: "mouseEnter",
          filters: [{ field: "isInsidePet", operator: "=", value: "true" }]
        },
        {
          type: "click",
          filters: [{ field: "distanceToPetBounds", operator: "<=", value: "24", unit: "px" }]
        }
      ],
      actionStrategy: "sequence",
      actionIds: ["wave"]
    });

    expect(rule).toEqual({
      id: "rule-2",
      name: "Enter then fast click",
      enabled: true,
      relation: "and",
      andWindowMs: 3500,
      cooldownMs: 900,
      priority: 7,
      conditions: [
        {
          type: "mouseEnter",
          filters: [{ field: "isInsidePet", operator: "=", value: true }]
        },
        {
          type: "click",
          filters: [{ field: "distanceToPetBounds", operator: "<=", value: 24, unit: "px" }]
        }
      ],
      actionStrategy: "sequence",
      actions: ["wave"]
    });
  });

  it("builds rule conditions without filters when no filter field is selected", () => {
    expect(buildRuleConditionFromForm({
      type: "click",
      field: "",
      operator: "=",
      value: "",
      unit: ""
    })).toEqual({
      type: "click",
      filters: []
    });
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

  it("limits filter fields to the selected condition type", () => {
    expect(getFieldsForCondition("click")).toContain("isInsidePet");
    expect(getFieldsForCondition("click")).not.toContain("speed");
    expect(getFieldsForCondition("mouseMove")).toContain("speed");
    expect(getFieldsForCondition("unknown")).toEqual([]);
  });

  it("rejects rules with invalid condition fields or missing action references", () => {
    expect(validateRuleForm({
      conditionType: "click",
      filterField: "speed",
      actionIds: ["wave"]
    }, [{ id: "wave" }])).toEqual(["Field speed is not supported by click."]);

    expect(validateRuleForm({
      conditionType: "click",
      filterField: "isInsidePet",
      actionIds: ["missing"]
    }, [{ id: "wave" }])).toEqual(["Unknown action ID: missing."]);

    expect(validateRuleForm({
      conditionType: "click",
      filterField: "isInsidePet",
      actionIds: []
    }, [{ id: "wave" }])).toEqual(["Select at least one action for this rule."]);

    expect(validateRuleForm({
      conditionType: "click",
      filterField: "isInsidePet",
      actionIds: []
    }, [])).toEqual(["Create at least one custom action before saving a trigger rule."]);
  });
});
