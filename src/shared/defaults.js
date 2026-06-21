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
  customActions: [
    {
      id: "default-click",
      name: "Default click state",
      type: "playAnimation",
      state: "click",
      durationMs: 900,
      returnToState: "idle"
    },
    {
      id: "default-drag",
      name: "Default drag state",
      type: "switchState",
      state: "drag"
    },
    {
      id: "default-hover",
      name: "Default hover state",
      type: "playAnimation",
      state: "hover",
      durationMs: 900,
      returnToState: "idle"
    },
    {
      id: "default-random",
      name: "Default random state",
      type: "playAnimation",
      state: "random",
      durationMs: 1200,
      returnToState: "idle"
    },
    {
      id: "default-timed",
      name: "Default timed state",
      type: "playAnimation",
      state: "timed",
      durationMs: 1200,
      returnToState: "idle"
    },
    {
      id: "default-sleep",
      name: "Default sleep state",
      type: "playAnimation",
      state: "sleep",
      durationMs: 1500,
      returnToState: "idle"
    },
    {
      id: "default-random-click-message",
      name: "Default click message",
      type: "randomMessage",
      messages: ["Hi there!"],
      durationMs: 1800
    }
  ],
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
    actions: ["default-hover"]
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
    actions: ["default-random"]
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
    actions: ["default-timed"]
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
    actions: ["default-sleep"]
  }
];

DEFAULT_CONFIG.triggerRules = DEFAULT_RULE_TEMPLATES;

module.exports = { DEFAULT_CONFIG, DEFAULT_RULE_TEMPLATES };
