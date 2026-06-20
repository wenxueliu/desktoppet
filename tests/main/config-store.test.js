import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import configStoreModule from "../../src/main/services/config-store";
import defaultsModule from "../../src/shared/defaults";

const { createConfigStore } = configStoreModule;
const { DEFAULT_CONFIG } = defaultsModule;

describe("createConfigStore", () => {
  let tempDir;
  let userDataDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-config-"));
    userDataDir = path.join(tempDir, "user-data");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads defaults when config file does not exist", () => {
    const store = createConfigStore(userDataDir);

    expect(store.load()).toEqual(DEFAULT_CONFIG);
  });

  it("persists updates", () => {
    const store = createConfigStore(userDataDir);

    const saved = store.save({
      currentPackageId: "sleepy-cat",
      display: { x: 240, scale: 1.5 },
      system: { language: "en-US" }
    });

    expect(saved).toEqual({
      ...DEFAULT_CONFIG,
      currentPackageId: "sleepy-cat",
      display: { ...DEFAULT_CONFIG.display, x: 240, scale: 1.5 },
      system: { ...DEFAULT_CONFIG.system, language: "en-US" }
    });
    expect(store.load()).toEqual(saved);
    expect(JSON.parse(fs.readFileSync(path.join(userDataDir, "config.json"), "utf8"))).toEqual(saved);
  });

  it("recovers from invalid JSON", () => {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(path.join(userDataDir, "config.json"), "{ invalid json", "utf8");

    const store = createConfigStore(userDataDir);

    expect(store.load()).toEqual(DEFAULT_CONFIG);
  });

  it("preserves unknown top-level keys", () => {
    const store = createConfigStore(userDataDir);

    const saved = store.save({
      display: { y: 320 },
      customActions: [{ id: "wave", action: "playAnimation" }]
    });

    expect(saved.customActions).toEqual([{ id: "wave", action: "playAnimation" }]);
    expect(store.load().customActions).toEqual([{ id: "wave", action: "playAnimation" }]);
  });

  it("does not mutate DEFAULT_CONFIG when saving nested display/system values", () => {
    const originalDefaults = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    const store = createConfigStore(userDataDir);

    store.save({
      display: { x: 999, alwaysOnTop: false },
      system: { language: "en-US", launchAtLogin: true }
    });

    expect(DEFAULT_CONFIG).toEqual(originalDefaults);
  });
});
