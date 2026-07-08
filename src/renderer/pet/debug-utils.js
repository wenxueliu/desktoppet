// 调试日志开关由系统设置里的日志开关（config.system.logging.enabled）驱动。
// pet 渲染进程在加载/更新配置时调用 setDebugRulesEnabled() 同步该状态。
let rulesEnabled = false;

function setDebugRulesEnabled(enabled) {
  rulesEnabled = Boolean(enabled);
}

function debugRulesEnabled() {
  return rulesEnabled;
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

export { debugRulesEnabled, setDebugRulesEnabled, createDebugLogger };
