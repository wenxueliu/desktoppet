const SUPPORTED_ASSET_EXTENSIONS = [".gif", ".webp", ".webm", ".mp4", ".mov", ".png", ".svg"];
const SUPPORTED_RELATIONS = ["single", "or", "and"];
const SUPPORTED_OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "between", "in", "notIn"];
const SUPPORTED_ACTION_TYPES = [
  "playAnimation",
  "setKeyframeProgress",
  "showMessage",
  "randomMessage",
  "changeScale",
  "changeOpacity",
  "hidePet",
  "showPet",
  "resetPosition",
  "openPanel"
];

const POINTER_FIELDS = [
  "timestamp",
  "eventSource",
  "petPosition",
  "mousePosition",
  "mouseLocalPosition",
  "isInsidePet",
  "distanceToPetCenter",
  "distanceToPetBounds",
  "screenPosition"
];

const DRAG_FIELDS = [
  ...POINTER_FIELDS,
  "dragStartPosition",
  "currentPosition",
  "dragDeltaX",
  "dragDeltaY",
  "dragDistance",
  "dragDurationMs"
];

const TIME_FIELDS = ["timestamp", "eventSource", "elapsedMs"];
const MOUSE_STILL_FIELDS = [...POINTER_FIELDS, "durationMs"];
const CLOCK_FIELDS = ["timestamp", "eventSource", "currentTime", "currentHour", "dayOfWeek"];

const TRIGGER_PARAMETER_FIELDS = {
  click: POINTER_FIELDS,
  doubleClick: POINTER_FIELDS,
  rightClick: POINTER_FIELDS,
  dragStart: DRAG_FIELDS,
  dragging: DRAG_FIELDS,
  dragEnd: DRAG_FIELDS,
  mouseEnter: POINTER_FIELDS,
  mouseLeave: POINTER_FIELDS,
  mouseMove: [
    ...POINTER_FIELDS,
    "deltaX",
    "deltaY",
    "speed",
    "direction",
    "angleToPet",
    "angleToPetDegrees",
    "angleToPetProgress",
    "isMovingTowardPet",
    "isMovingAwayFromPet"
  ],
  mouseStill: MOUSE_STILL_FIELDS,
  hoverDuration: [...TIME_FIELDS, "isInsidePet"],
  idleDuration: TIME_FIELDS,
  timer: CLOCK_FIELDS,
  randomTimer: CLOCK_FIELDS,
  appLaunch: ["timestamp", "eventSource"],
  packageLoaded: ["timestamp", "eventSource"]
};

module.exports = {
  SUPPORTED_ASSET_EXTENSIONS,
  SUPPORTED_RELATIONS,
  SUPPORTED_OPERATORS,
  SUPPORTED_ACTION_TYPES,
  TRIGGER_PARAMETER_FIELDS
};
