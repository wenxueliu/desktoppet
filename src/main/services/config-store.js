const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_CONFIG } = require("../../shared/defaults");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(config) {
  const nextConfig = isPlainObject(config) ? config : {};

  return {
    ...DEFAULT_CONFIG,
    ...nextConfig,
    display: {
      ...DEFAULT_CONFIG.display,
      ...(isPlainObject(nextConfig.display) ? nextConfig.display : {})
    },
    system: {
      ...DEFAULT_CONFIG.system,
      ...(isPlainObject(nextConfig.system) ? nextConfig.system : {})
    }
  };
}

function createConfigStore(userDataDir) {
  const configPath = path.join(userDataDir, "config.json");

  function ensureUserDataDir() {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  function load() {
    ensureUserDataDir();

    if (!fs.existsSync(configPath)) {
      return mergeConfig();
    }

    try {
      return mergeConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
    } catch (error) {
      return mergeConfig();
    }
  }

  function save(nextConfig) {
    ensureUserDataDir();
    const config = mergeConfig(nextConfig);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    return config;
  }

  return {
    configPath,
    load,
    save
  };
}

module.exports = { createConfigStore };
