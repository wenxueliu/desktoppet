const DEFAULT_CONFIG = {
  currentPackageId: "default-pet",
  display: {
    x: 80,
    y: 160,
    scale: 1,
    opacity: 1,
    alwaysOnTop: true,
    mousePassthrough: false,
    locked: false,
    showHoverButtons: true
  },
  system: {
    launchAtLogin: false,
    language: "zh-CN"
  }
};

const DEFAULT_RULE_TEMPLATES = [
  {
    id: "default-click-greeting",
    name: "点击打招呼",
    enabled: true,
    relation: "single",
    conditions: [{ type: "click", filters: [{ field: "isInsidePet", operator: "=", value: true }] }],
    cooldownMs: 1000,
    priority: 50,
    actionStrategy: "sequence",
    actions: ["default-click", "default-random-click-message"]
  },
  {
    id: "default-dragging",
    name: "拖动中",
    enabled: true,
    relation: "or",
    conditions: [{ type: "dragStart" }, { type: "dragging" }],
    cooldownMs: 0,
    priority: 90,
    actionStrategy: "sequence",
    interruptCurrent: true,
    actions: ["default-drag"]
  }
];

module.exports = { DEFAULT_CONFIG, DEFAULT_RULE_TEMPLATES };
