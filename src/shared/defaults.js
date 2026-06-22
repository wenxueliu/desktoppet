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
    language: "en"
  },
  animations: {
    default: { id: "idle", asset: "assets/idle.svg" },
    clips: [
      { id: "click", asset: "assets/click.svg", type: "oneshot", durationMs: 900 },
      { id: "drag", asset: "assets/drag.svg", type: "loop" }
    ]
  },
  interactions: {
    clickMessages: ["Hi there!"],
    randomMessages: ["I'm here."],
    timedMessages: [],
    importSuccessMessage: "Petpack imported.",
    bubble: {
      maxWidth: 220,
      durationMs: 1800,
      showCloseButton: false
    }
  },
  triggerRules: []
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
    actions: [
      { type: "playAnimation", animation: "click", durationMs: 900 },
      { type: "randomMessage", messages: ["Hi there!"], durationMs: 1800 }
    ]
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
    actions: [{ type: "playAnimation", animation: "drag" }]
  },
  {
    id: "default-hover",
    name: "悬停互动",
    enabled: true,
    relation: "single",
    conditions: [{ type: "mouseEnter" }],
    cooldownMs: 1000,
    priority: 30,
    actionStrategy: "sequence",
    actions: [{ type: "playAnimation", animation: "click", durationMs: 900 }]
  },
  {
    id: "default-random-timer",
    name: "随机互动",
    enabled: true,
    relation: "single",
    conditions: [{ type: "randomTimer" }],
    cooldownMs: 5000,
    priority: 10,
    actionStrategy: "sequence",
    actions: [{ type: "playAnimation", animation: "click", durationMs: 1200 }]
  },
  {
    id: "default-timed",
    name: "定时互动",
    enabled: true,
    relation: "single",
    conditions: [{ type: "timer" }],
    cooldownMs: 5000,
    priority: 10,
    actionStrategy: "sequence",
    actions: [{ type: "showMessage", text: "I'm here.", durationMs: 1800 }]
  },
  {
    id: "default-idle-sleep",
    name: "休息状态",
    enabled: true,
    relation: "single",
    conditions: [{ type: "idleDuration", filters: [{ field: "elapsedMs", operator: ">=", value: 60000, unit: "ms" }] }],
    cooldownMs: 10000,
    priority: 5,
    actionStrategy: "sequence",
    actions: [{ type: "showMessage", text: "Zzz...", durationMs: 1800 }]
  }
];

DEFAULT_CONFIG.triggerRules = DEFAULT_RULE_TEMPLATES;

module.exports = { DEFAULT_CONFIG, DEFAULT_RULE_TEMPLATES };
