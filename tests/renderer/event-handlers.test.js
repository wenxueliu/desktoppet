import { afterEach, describe, expect, it, vi } from "vitest";
import { handleChange, handleInput } from "../../src/renderer/panel/handlers/event-handlers";

describe("panel event handlers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete globalThis.document;
  });

  it("applies display scale while the slider moves without saving", async () => {
    const scaleValue = { textContent: "" };
    globalThis.document = {
      querySelector: vi.fn((selector) => selector === "#scale-value" ? scaleValue : null)
    };
    const state = {
      config: {
        display: { scale: 1, opacity: 0.8, alwaysOnTop: true }
      }
    };
    const api = {
      pet: {
        applyDisplay: vi.fn(async () => {})
      }
    };
    const saveConfig = vi.fn(async (nextConfig) => nextConfig);

    handleInput({ target: { id: "display-scale", value: "125" } }, state, vi.fn(), api, saveConfig);

    expect(scaleValue.textContent).toBe("125%");
    expect(state.config.display).toMatchObject({ scale: 1.25, opacity: 0.8, alwaysOnTop: true });
    expect(api.pet.applyDisplay).toHaveBeenCalledWith(state.config.display);
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it("applies display opacity while the slider moves without saving", async () => {
    const opacityValue = { textContent: "" };
    globalThis.document = {
      querySelector: vi.fn((selector) => selector === "#opacity-value" ? opacityValue : null)
    };
    const state = {
      config: {
        display: { scale: 1, opacity: 0.8, alwaysOnTop: true }
      }
    };
    const api = {
      pet: {
        applyDisplay: vi.fn(async () => {})
      }
    };
    const saveConfig = vi.fn(async (nextConfig) => nextConfig);

    handleInput({ target: { id: "display-opacity", value: "65" } }, state, vi.fn(), api, saveConfig);

    expect(opacityValue.textContent).toBe("65%");
    expect(state.config.display).toMatchObject({ scale: 1, opacity: 0.65, alwaysOnTop: true });
    expect(api.pet.applyDisplay).toHaveBeenCalledWith(state.config.display);
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it("saves display scale when the slider change is committed", async () => {
    const state = {
      config: {
        display: { scale: 1, opacity: 0.8, alwaysOnTop: true }
      }
    };
    const api = {
      pet: {
        applyDisplay: vi.fn(async () => {})
      }
    };
    const saveConfig = vi.fn(async (nextConfig) => nextConfig);

    await handleChange({ target: { id: "display-scale", value: "125" } }, state, api, vi.fn(), saveConfig);

    expect(saveConfig).toHaveBeenCalledWith(state.config, "display");
    expect(state.config.display.scale).toBe(1.25);
  });

  it("saves display opacity when the slider change is committed", async () => {
    const state = {
      config: {
        display: { scale: 1, opacity: 0.8, alwaysOnTop: true }
      }
    };
    const api = {
      pet: {
        applyDisplay: vi.fn(async () => {})
      }
    };
    const saveConfig = vi.fn(async (nextConfig) => nextConfig);

    await handleChange({ target: { id: "display-opacity", value: "65" } }, state, api, vi.fn(), saveConfig);

    expect(saveConfig).toHaveBeenCalledWith(state.config, "display");
    expect(state.config.display.opacity).toBe(0.65);
  });

  it("applies and saves display toggles immediately", async () => {
    const state = {
      config: {
        display: { scale: 1, opacity: 0.8, alwaysOnTop: true, mousePassthrough: false }
      }
    };
    const api = {
      pet: {
        applyDisplay: vi.fn(async () => {}),
        setAlwaysOnTop: vi.fn(async () => {}),
        setMousePassthrough: vi.fn(async () => {})
      }
    };
    const saveConfig = vi.fn(async (nextConfig) => nextConfig);

    await handleChange({ target: { name: "alwaysOnTop", checked: false } }, state, api, vi.fn(), saveConfig);
    await handleChange({ target: { name: "mousePassthrough", checked: true } }, state, api, vi.fn(), saveConfig);

    expect(api.pet.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(api.pet.setMousePassthrough).toHaveBeenCalledWith(true);
    expect(state.config.display).toMatchObject({ alwaysOnTop: false, mousePassthrough: true });
    expect(saveConfig).toHaveBeenCalledTimes(2);
  });
});
