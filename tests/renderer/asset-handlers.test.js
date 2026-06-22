import { describe, expect, it, vi } from "vitest";
import { deleteReferencedAsset } from "../../src/renderer/panel/handlers/asset-handlers";

describe("asset handlers", () => {
  it("deletes package assets from the current package instead of stale import state", async () => {
    const api = {
      assets: {
        delete: vi.fn(async () => ({ ok: true, asset: "assets/wave.webm" }))
      },
      config: {
        save: vi.fn(async (config) => config),
        load: vi.fn(async () => ({
          currentPackageId: "current-pet",
          animations: { default: { id: "idle", asset: "" }, clips: [] },
          triggerRules: []
        }))
      }
    };
    const state = {
      selectedAssetPackageId: "old-import-pet",
      config: {
        currentPackageId: "current-pet",
        animations: {
          default: { id: "idle", asset: "assets/idle.svg" },
          clips: [{ id: "wave", asset: "assets/wave.webm" }]
        },
        triggerRules: []
      },
      savingKey: ""
    };

    await deleteReferencedAsset("assets/wave.webm", api, state, vi.fn());

    expect(api.assets.delete).toHaveBeenCalledWith("assets/wave.webm", "current-pet");
  });
});
