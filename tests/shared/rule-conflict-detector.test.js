import { describe, expect, it } from "vitest";
import { detectRuleConflicts } from "../../src/shared/rule-conflict-detector";

describe("detectRuleConflicts", () => {
  it("reports same-event rules without filters as trigger overlaps", () => {
    const conflicts = detectRuleConflicts([
      { id: "first", name: "First click", conditions: [{ type: "click", filters: [] }] },
      { id: "second", name: "Second click", conditions: [{ type: "click", filters: [] }] }
    ]);

    expect(conflicts).toEqual([
      expect.objectContaining({
        type: "triggerOverlap",
        ruleIds: ["first", "second"],
        messageKey: "rules.conflicts.triggerOverlap"
      })
    ]);
  });

  it("reports higher-priority stop-on-match rules that may shadow lower-priority rules", () => {
    const conflicts = detectRuleConflicts([
      { id: "low", name: "Low click", priority: 1, conditions: [{ type: "click", filters: [] }] },
      { id: "high", name: "High click", priority: 10, conditions: [{ type: "click", filters: [] }] }
    ]);

    expect(conflicts).toEqual([
      expect.objectContaining({
        type: "priorityShadow",
        ruleIds: ["high", "low"],
        params: expect.objectContaining({
          highRule: "High click",
          lowRule: "Low click"
        })
      })
    ]);
  });

  it("does not report rules with different event types", () => {
    const conflicts = detectRuleConflicts([
      { id: "click", name: "Click", conditions: [{ type: "click", filters: [] }] },
      { id: "enter", name: "Enter", conditions: [{ type: "mouseEnter", filters: [] }] }
    ]);

    expect(conflicts).toEqual([]);
  });

  it("reports mouse enter and hover duration rules as overlapping hover interactions", () => {
    const conflicts = detectRuleConflicts([
      { id: "enter", name: "Mouse enter", conditions: [{ type: "mouseEnter", filters: [] }] },
      { id: "hover", name: "Hover", conditions: [{ type: "hoverDuration", filters: [{ field: "elapsedMs", operator: ">=", value: 1000 }] }] }
    ]);

    expect(conflicts).toContainEqual(expect.objectContaining({
      type: "triggerOverlap",
      ruleIds: ["enter", "hover"],
      messageKey: "rules.conflicts.triggerOverlap"
    }));
  });

  it("ignores disabled rules", () => {
    const conflicts = detectRuleConflicts([
      { id: "enabled", name: "Enabled", conditions: [{ type: "click", filters: [] }] },
      { id: "disabled", name: "Disabled", enabled: false, conditions: [{ type: "click", filters: [] }] }
    ]);

    expect(conflicts).toEqual([]);
  });

  it("reports conflicting hide and show actions for overlapping rules", () => {
    const conflicts = detectRuleConflicts([
      {
        id: "hide",
        name: "Hide",
        conditions: [{ type: "click", filters: [] }],
        actions: [{ type: "hidePet" }]
      },
      {
        id: "show",
        name: "Show",
        conditions: [{ type: "click", filters: [] }],
        actions: [{ type: "showPet" }]
      }
    ]);

    expect(conflicts).toContainEqual(expect.objectContaining({
      type: "actionConflict",
      ruleIds: ["hide", "show"],
      messageKey: "rules.conflicts.actionPairConflict",
      params: expect.objectContaining({
        leftActionType: "hidePet",
        rightActionType: "showPet"
      })
    }));
  });

  it("reports repeated overriding actions for overlapping rules", () => {
    const conflicts = detectRuleConflicts([
      {
        id: "one",
        name: "One",
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }] }],
        actions: [{ type: "playAnimation", animation: "idle" }]
      },
      {
        id: "two",
        name: "Two",
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 200 }] }],
        actions: [{ type: "playAnimation", animation: "wave" }]
      }
    ]);

    expect(conflicts).toContainEqual(expect.objectContaining({
      type: "actionConflict",
      ruleIds: ["one", "two"],
      messageKey: "rules.conflicts.actionConflict",
      params: expect.objectContaining({ actionType: "playAnimation" })
    }));
  });
});
