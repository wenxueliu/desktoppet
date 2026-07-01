import { describe, expect, it } from "vitest";
import { renderOverview } from "../../src/renderer/panel/tabs/overview";

describe("overview tab", () => {
  it("shows recently triggered rule action summaries including blank actions", () => {
    const html = renderOverview({
      currentPackageId: "pet",
      animations: {
        default: { id: "idle", name: "Idle", asset: "assets/idle.svg" },
        clips: []
      },
      triggerRules: [{
        id: "rule-wait",
        name: "Wait before wave",
        conditions: [{ type: "click", filters: [] }],
        actions: [{ type: "blank", durationMs: 1500 }]
      }]
    }, {
      currentState: {
        animation: "idle",
        sprite: "",
        position: { x: 10, y: 20 },
        display: { scale: 1, opacity: 1 }
      },
      recentEvents: [],
      ruleStates: { "rule-wait": Date.now() },
      timers: [],
      interactionsPaused: false
    });

    expect(html).toContain("Wait before wave");
    expect(html).toContain("Blank action · 1500ms");
  });

  it("omits system status and expands recent triggered rules", () => {
    const triggerRules = Array.from({ length: 7 }, (_, index) => ({
      id: `rule-${index}`,
      name: `Rule ${index}`,
      conditions: [{ type: "click", filters: [] }],
      actions: [{ type: "showMessage", text: `Rule ${index}` }]
    }));
    const now = Date.now();
    const ruleStates = Object.fromEntries(triggerRules.map((rule, index) => [rule.id, now - index]));

    const html = renderOverview({
      currentPackageId: "pet",
      animations: {
        default: { id: "idle", name: "Idle", asset: "assets/idle.svg" },
        clips: []
      },
      triggerRules
    }, {
      currentState: {
        animation: "idle",
        sprite: "",
        position: { x: 10, y: 20 },
        display: { scale: 1, opacity: 1 }
      },
      recentEvents: [],
      ruleStates,
      timers: [],
      interactionsPaused: true
    });

    expect(html).not.toContain("System Status");
    expect(html).toContain("recent-rules-card");
    expect(html).toContain("Rule 0");
    expect(html).toContain("Rule 5");
    expect(html).not.toContain("Rule 6");
  });
});
