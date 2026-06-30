import { describe, expect, it, vi } from "vitest";
import { saveRuleFromForm } from "../../src/renderer/panel/handlers/form-handlers";

function createField(value, checked = false) {
  return { value, checked };
}

function createRow(fields) {
  return {
    querySelector: vi.fn((selector) => fields[selector] || null)
  };
}

describe("panel form handlers", () => {
  it("saves blank rule actions with editable duration", async () => {
    const conditionRow = createRow({
      '[name="conditionType"]': createField("click"),
      '[name="filterField"]': createField(""),
      '[name="filterOperator"]': createField("="),
      '[name="filterValue"]': createField(""),
      '[name="filterUnit"]': createField(""),
      '[name="conditionRequired"]': createField("", true)
    });
    const actionRow = createRow({
      '[name="actionType"]': createField("blank"),
      '[name="durationMs"]': createField("1500")
    });
    const form = {
      elements: {
        id: createField("rule-wait"),
        name: createField("Wait before waving"),
        cooldownMs: createField("0"),
        priority: createField("1"),
        stopOnMatch: createField("", true),
        actionStrategy: createField("sequence")
      },
      querySelectorAll: vi.fn((selector) => {
        if (selector === '[data-rule-condition][data-scope="conditions"]') return [conditionRow];
        if (selector === '[data-rule-condition][data-scope="exitConditions"]') return [];
        if (selector === '[data-inline-action][data-scope="actions"]') return [actionRow];
        if (selector === '[data-inline-action][data-scope="exitActions"]') return [];
        return [];
      })
    };
    const config = {
      animations: { default: { id: "idle", asset: "" }, clips: [] },
      triggerRules: []
    };
    const state = { selectedRuleId: "", ruleEditorOpen: true };
    const render = vi.fn();
    const saveConfig = vi.fn(async (nextConfig) => nextConfig);

    await saveRuleFromForm(form, config, saveConfig, state, render);

    expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      triggerRules: [expect.objectContaining({
        id: "rule-wait",
        actions: [{ type: "blank", durationMs: 1500 }]
      })]
    }), "rule");
    expect(state.selectedRuleId).toBe("rule-wait");
    expect(state.ruleEditorOpen).toBe(false);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
