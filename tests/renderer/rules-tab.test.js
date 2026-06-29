import { describe, expect, it, vi } from "vitest";
import { handleClickAction } from "../../src/renderer/panel/handlers/event-handlers";
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
    expect(html).toContain('data-action="toggle-rule-enabled"');
    expect(html).toContain('data-action="close-rule-editor"');
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
