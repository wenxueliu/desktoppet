import { describe, expect, it, vi } from "vitest";
import { handleChange, handleClickAction } from "../../src/renderer/panel/handlers/event-handlers";
import { renderRuleConditionEditor } from "../../src/renderer/panel/components/rule-condition-editor";
import { renderRules } from "../../src/renderer/panel/tabs/rules";

describe("rules tab", () => {
  const config = {
    animations: {
      default: { id: "idle", name: "Idle", asset: "assets/idle.svg" },
      clips: []
    },
    triggerRules: [
      {
        id: "rule-click",
        name: "Click reaction",
        enabled: true,
        relation: "single",
        priority: 1,
        conditions: [{ type: "click", filters: [] }],
        actions: [{ type: "playAnimation", animation: "idle", durationMs: 900 }]
      }
    ]
  };

  it("renders the rule editor only when the modal state is open", () => {
    expect(renderRules({ selectedRuleId: "", ruleEditorOpen: false, savingKey: "" }, config)).not.toContain("modal-panel rule-editor-modal");

    const html = renderRules({ selectedRuleId: "", ruleEditorOpen: true, savingKey: "" }, config);
    expect(html).toContain("modal-panel rule-editor-modal");
    expect(html).toContain('id="rule-form"');
    expect(html).not.toContain('name="enabled"');
    expect(html).toContain('name="stopOnMatch" type="checkbox" checked');
    expect(html).toContain('data-action="toggle-rule-enabled"');
    expect(html).toContain('data-action="close-rule-editor"');
  });

  it("renders translated condition names in the rule list", () => {
    const html = renderRules({ selectedRuleId: "", ruleEditorOpen: false, savingKey: "" }, config);

    expect(html).toContain(">Click</span>");
    expect(html).not.toContain(">click</span>");
  });

  it("renders the stop-on-match switch in basic information and reflects disabled state", () => {
    const html = renderRules({ selectedRuleId: "rule-click", ruleEditorOpen: true, savingKey: "" }, {
      ...config,
      triggerRules: [{ ...config.triggerRules[0], stopOnMatch: false }]
    });
    const basicInfoIndex = html.indexOf("Basic Information");
    const stopOnMatchIndex = html.indexOf('name="stopOnMatch"');
    const triggerConditionsIndex = html.indexOf("Trigger Conditions");
    const inputSnippet = html.slice(stopOnMatchIndex, stopOnMatchIndex + 80);

    expect(basicInfoIndex).toBeGreaterThan(-1);
    expect(stopOnMatchIndex).toBeGreaterThan(basicInfoIndex);
    expect(stopOnMatchIndex).toBeLessThan(triggerConditionsIndex);
    expect(inputSnippet).not.toContain("checked");
  });

  it("renders exit condition/action blocks only for mouseMove trigger rules", () => {
    const newRuleHtml = renderRules({ selectedRuleId: "", ruleEditorOpen: true, savingKey: "" }, config);

    expect(newRuleHtml).toContain('name="conditionSustainMs"');
    expect(newRuleHtml).toContain('name="conditionRequired"');
    expect(newRuleHtml).toContain('data-role="exit-state-block" style="display: none;"');
    expect(newRuleHtml).toContain('data-scope="actions"');
    expect(newRuleHtml).toContain('data-scope="exitActions"');

    const mouseMoveConfig = {
      ...config,
      triggerRules: [{
        id: "rule-near",
        name: "Near",
        enabled: true,
        relation: "single",
        priority: 1,
        conditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: "<", value: 300 }], sustainMs: 3000 }],
        actions: [{ type: "playAnimation", animation: "idle", durationMs: 900 }],
        state: {
          exitRelation: "single",
          exitConditions: [{ type: "mouseMove", filters: [{ field: "distanceToPetCenter", operator: ">=", value: 300 }], sustainMs: 3000 }],
          exitActions: [{ type: "playAnimation", animation: "idle", durationMs: 900 }]
        }
      }]
    };
    const mouseMoveHtml = renderRules({ selectedRuleId: "rule-near", ruleEditorOpen: true, savingKey: "" }, mouseMoveConfig);

    expect(mouseMoveHtml).not.toContain('name="exitRelation"');
    expect(mouseMoveHtml).not.toContain('name="exitAndWindowMs"');
    expect(mouseMoveHtml).toContain('data-scope="exitConditions"');
    expect(mouseMoveHtml).toContain('data-action="add-rule-condition" data-scope="exitConditions"');
    expect(mouseMoveHtml.match(/data-action="show-condition-help"/g)).toHaveLength(2);
    expect(mouseMoveHtml).not.toContain('data-role="exit-state-block" style="display: none;"');
  });

  it("renders filter controls according to field type", () => {
    const booleanHtml = renderRuleConditionEditor({
      type: "click",
      filters: [{ field: "isInsidePet", operator: "!=", value: true }]
    }, 0);
    const numberHtml = renderRuleConditionEditor({
      type: "mouseMove",
      filters: [{ field: "speed", operator: ">", value: 100 }]
    }, 0);
    const selectHtml = renderRuleConditionEditor({
      type: "mouseMove",
      filters: [{ field: "direction", operator: "=", value: "right" }]
    }, 0);
    const noFilterHtml = renderRuleConditionEditor({ type: "click", filters: [] }, 0);

    expect(booleanHtml).toContain('data-role="filter-operator-container" style="display: none;"');
    expect(booleanHtml).toContain('name="filterOperator" value="="');
    expect(booleanHtml).toContain('<option value="true" selected>True</option>');
    expect(booleanHtml).toContain('<option value="false" >False</option>');

    const numberOperatorHtml = numberHtml.slice(numberHtml.indexOf('data-role="filter-operator-container"'), numberHtml.indexOf('data-role="filter-value-container"'));
    expect(numberOperatorHtml).toContain('<option value="between"');
    expect(numberOperatorHtml).toContain('<option value="&gt;" selected>&gt;</option>');
    expect(numberHtml).toContain('name="filterValue" data-role="filter-value" type="number"');

    const selectOperatorHtml = selectHtml.slice(selectHtml.indexOf('data-role="filter-operator-container"'), selectHtml.indexOf('data-role="filter-value-container"'));
    expect(selectOperatorHtml).toContain('<option value="in"');
    expect(selectOperatorHtml).not.toContain('<option value="between"');
    expect(selectHtml).toContain('<option value="right" selected>Right</option>');

    expect(noFilterHtml).toContain('data-role="filter-operator-container" style="display: none;"');
    expect(noFilterHtml).toContain('data-role="filter-value-container" style="display: none;"');
    expect(noFilterHtml).not.toContain('value="petPosition"');
  });

  it("refreshes filter operator and value controls when field choices change", async () => {
    const replacements = {};
    const operatorContainer = {};
    const valueContainer = {};
    Object.defineProperty(operatorContainer, "outerHTML", {
      set: (value) => { replacements.operator = value; }
    });
    Object.defineProperty(valueContainer, "outerHTML", {
      set: (value) => { replacements.value = value; }
    });
    const row = {
      dataset: { scope: "conditions" },
      parentElement: null,
      querySelector: (selector) => {
        if (selector === '[data-role="filter-operator-container"]') return operatorContainer;
        if (selector === '[data-role="filter-value-container"]') return valueContainer;
        return null;
      }
    };
    const target = {
      dataset: { role: "filter-field" },
      classList: { contains: () => false },
      value: "isInsidePet",
      closest: () => row
    };

    await handleChange({ target }, {}, {}, vi.fn(), vi.fn());

    expect(replacements.operator).toContain('style="display: none;"');
    expect(replacements.operator).toContain('name="filterOperator" value="="');
    expect(replacements.value).toContain('<select id="rule-filter-value-conditions-0" name="filterValue" data-role="filter-value">');
    expect(replacements.value).toContain('<option value="true" selected>True</option>');

    target.value = "";
    await handleChange({ target }, {}, {}, vi.fn(), vi.fn());

    expect(replacements.operator).toContain('style="display: none;"');
    expect(replacements.value).toContain('style="display: none;"');
    expect(replacements.value).toContain('name="filterValue" value=""');
  });

  it("resets filter field, operator, and value when condition type changes", async () => {
    const replacements = {};
    const operatorContainer = {};
    const valueContainer = {};
    Object.defineProperty(operatorContainer, "outerHTML", {
      set: (value) => { replacements.operator = value; }
    });
    Object.defineProperty(valueContainer, "outerHTML", {
      set: (value) => { replacements.value = value; }
    });
    const fieldSelect = { innerHTML: "", value: "speed" };
    const row = {
      dataset: { scope: "conditions" },
      parentElement: null,
      querySelector: (selector) => {
        if (selector === '[data-role="filter-field"]') return fieldSelect;
        if (selector === '[data-role="filter-operator-container"]') return operatorContainer;
        if (selector === '[data-role="filter-value-container"]') return valueContainer;
        if (selector === '[data-role="condition-sustain"]') return null;
        return null;
      }
    };
    const target = {
      dataset: { role: "condition-type" },
      classList: { contains: () => false },
      value: "click",
      closest: (selector) => selector === "[data-rule-condition]" ? row : null
    };

    await handleChange({ target }, {}, {}, vi.fn(), vi.fn());

    expect(fieldSelect.value).toBe("");
    expect(fieldSelect.innerHTML).toContain('value="isInsidePet"');
    expect(fieldSelect.innerHTML).not.toContain('value="petPosition"');
    expect(replacements.operator).toContain('style="display: none;"');
    expect(replacements.value).toContain('style="display: none;"');
  });

  it("refreshes the filter value control when operator changes", async () => {
    const replacements = {};
    const operatorContainer = {};
    const valueContainer = {};
    Object.defineProperty(operatorContainer, "outerHTML", {
      set: (value) => { replacements.operator = value; }
    });
    Object.defineProperty(valueContainer, "outerHTML", {
      set: (value) => { replacements.value = value; }
    });
    const fieldSelect = { value: "speed" };
    const row = {
      dataset: { scope: "conditions" },
      parentElement: null,
      querySelector: (selector) => {
        if (selector === '[data-role="filter-field"]') return fieldSelect;
        if (selector === '[data-role="filter-operator-container"]') return operatorContainer;
        if (selector === '[data-role="filter-value-container"]') return valueContainer;
        return null;
      }
    };
    const target = {
      dataset: { role: "filter-operator" },
      classList: { contains: () => false },
      value: "between",
      closest: () => row
    };

    await handleChange({ target }, {}, {}, vi.fn(), vi.fn());

    expect(replacements.operator).toContain('<option value="between" selected>');
    expect(replacements.value).toContain('type="text" inputmode="decimal"');
    expect(replacements.value).toContain('Comma-separated values');
    expect(replacements.value).not.toContain('value="100"');
  });

  it("opens the modal for new and existing rules from click actions", async () => {
    const state = { config, savingKey: "", selectedRuleId: "", ruleEditorOpen: false };
    const render = vi.fn();
    const makeEvent = (action, id) => ({
      target: {
        closest: () => ({ dataset: { action, id } })
      }
    });

    await handleClickAction(makeEvent("new-rule"), state, {}, vi.fn(), render);
    expect(state).toMatchObject({ selectedRuleId: "", ruleEditorOpen: true });
    expect(render).toHaveBeenCalledTimes(1);

    await handleClickAction(makeEvent("edit-rule", "rule-click"), state, {}, vi.fn(), render);
    expect(state).toMatchObject({ selectedRuleId: "rule-click", ruleEditorOpen: true });
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("saves rule enabled state from the list switch", async () => {
    const state = { config, savingKey: "", selectedRuleId: "", ruleEditorOpen: false };
    const saveConfig = vi.fn(async (nextConfig) => nextConfig);
    const input = { dataset: { action: "toggle-rule-enabled", id: "rule-click" }, checked: false };

    await handleClickAction({ target: { closest: () => input } }, state, {}, saveConfig, vi.fn());

    expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      triggerRules: [expect.objectContaining({ id: "rule-click", enabled: false })]
    }), "rule");
  });
});
