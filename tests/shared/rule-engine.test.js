import { describe, expect, it } from "vitest";
import ruleEngine from "../../src/shared/rule-engine";

const { evaluateRules } = ruleEngine;

describe("evaluateRules", () => {
  const now = 10_000;

  it("matches a single condition with multiple filters", () => {
    const rules = [
      {
        id: "near-fast",
        enabled: true,
        relation: "single",
        priority: 4,
        conditions: [
          {
            type: "mouseMove",
            filters: [
              { field: "distanceToPetBounds", operator: "<=", value: 40 },
              { field: "speed", operator: ">", value: 100 },
              { field: "direction", operator: "=", value: "right" }
            ]
          }
        ]
      }
    ];

    const result = evaluateRules({
      rules,
      eventHistory: [
        { type: "mouseMove", timestamp: now, distanceToPetBounds: 24, speed: 160, direction: "right" }
      ],
      now,
      lastTriggeredAtByRuleId: {}
    });

    expect(result).toEqual([rules[0]]);
  });

  it("respects the AND window", () => {
    const rules = [
      {
        id: "enter-then-click",
        relation: "and",
        windowMs: 3000,
        conditions: ["mouseEnter", "click"]
      }
    ];

    expect(evaluateRules({
      rules,
      eventHistory: [
        { type: "mouseEnter", timestamp: now - 4000 },
        { type: "click", timestamp: now - 500 }
      ],
      now,
      lastTriggeredAtByRuleId: {}
    })).toEqual([]);

    expect(evaluateRules({
      rules,
      eventHistory: [
        { type: "mouseEnter", timestamp: now - 2500 },
        { type: "click", timestamp: now - 500 }
      ],
      now,
      lastTriggeredAtByRuleId: {}
    })).toEqual([rules[0]]);
  });

  it("filters by cooldown and sorts by descending priority", () => {
    const rules = [
      { id: "low", relation: "single", priority: 1, conditions: ["click"] },
      { id: "cooling", relation: "single", priority: 99, cooldownMs: 5000, conditions: ["click"] },
      { id: "high", relation: "single", priority: 10, conditions: ["click"] }
    ];

    const result = evaluateRules({
      rules,
      eventHistory: [{ type: "click", timestamp: now }],
      now,
      lastTriggeredAtByRuleId: {
        cooling: now - 1000
      }
    });

    expect(result.map((rule) => rule.id)).toEqual(["high", "low"]);
  });

  it("supports OR", () => {
    const rules = [
      {
        id: "click-or-enter",
        relation: "or",
        conditions: ["doubleClick", "mouseEnter"]
      }
    ];

    const result = evaluateRules({
      rules,
      eventHistory: [{ type: "mouseEnter", timestamp: now }],
      now,
      lastTriggeredAtByRuleId: {}
    });

    expect(result).toEqual([rules[0]]);
  });

  it("supports all filter operators", () => {
    const event = {
      type: "mouseMove",
      timestamp: now,
      distanceToPetBounds: 25,
      speed: 120,
      direction: "left",
      isInsidePet: false,
      deltaX: -30
    };
    const rules = [
      {
        id: "operators",
        relation: "single",
        conditions: [
          {
            type: "mouseMove",
            filters: [
              { field: "distanceToPetBounds", operator: "=", value: 25 },
              { field: "direction", operator: "!=", value: "right" },
              { field: "speed", operator: ">", value: 100 },
              { field: "speed", operator: ">=", value: 120 },
              { field: "distanceToPetBounds", operator: "<", value: 40 },
              { field: "distanceToPetBounds", operator: "<=", value: 25 },
              { field: "distanceToPetBounds", operator: "between", value: [20, 30] },
              { field: "direction", operator: "in", value: ["left", "up"] },
              { field: "isInsidePet", operator: "notIn", value: [true] }
            ]
          }
        ]
      },
      {
        id: "failing-not-in",
        relation: "single",
        conditions: [
          {
            type: "mouseMove",
            filters: [{ field: "deltaX", operator: "notIn", value: [-30, -20] }]
          }
        ]
      }
    ];

    const result = evaluateRules({
      rules,
      eventHistory: [event],
      now,
      lastTriggeredAtByRuleId: {}
    });

    expect(result).toEqual([rules[0]]);
  });

  it("ignores disabled rules", () => {
    const rules = [
      { id: "disabled", enabled: false, relation: "single", conditions: ["click"] },
      { id: "enabled", relation: "single", conditions: ["click"] }
    ];

    const result = evaluateRules({
      rules,
      eventHistory: [{ type: "click", timestamp: now }],
      now,
      lastTriggeredAtByRuleId: {}
    });

    expect(result).toEqual([rules[1]]);
  });
});
