function debugRulesEnabled() {
  try {
    return Boolean(globalThis.__DESKTOP_PET_DEBUG_RULES__) ||
      Boolean(globalThis.desktopPet && globalThis.desktopPet.debugRules) ||
      (globalThis.localStorage && globalThis.localStorage.getItem("desktopPetDebugRules") === "1");
  } catch (_error) {
    return false;
  }
}

function formatDebugArg(arg) {
  if (arg && typeof arg === "object") {
    try {
      return JSON.stringify(arg);
    } catch (_error) {
      return String(arg);
    }
  }
  return arg;
}

function createDebugLogger(prefix) {
  return function debugLog(...args) {
    if (debugRulesEnabled()) {
      const api = globalThis.desktopPet;
      if (api && api.logs && typeof api.logs.write === "function") {
        api.logs.write("debug", "pet-rules", prefix, args.map(formatDebugArg));
      }
    }
  };
}

export { debugRulesEnabled, createDebugLogger };
