import { describe, expect, it } from "vitest";
import { getAssetReferences, renderAssets } from "../../src/renderer/panel/tabs/assets";

describe("assets tab", () => {
  const config = {
    currentPackageId: "default-pet",
    animations: {
      default: { id: "idle", asset: "assets/idle.svg" },
      clips: [
        { id: "click", asset: "assets/click.svg", type: "oneshot" },
        { id: "drag", asset: "assets/drag.svg", type: "loop" },
        { id: "unused-animation", asset: "assets/unused.svg", type: "oneshot" }
      ]
    },
    triggerRules: [
      {
        id: "click-rule",
        name: "Click reaction",
        actions: [{ type: "playAnimation", animation: "click" }]
      }
    ]
  };

  it("renders package list, current marker, import name, and package assets with previews", () => {
    const html = renderAssets({
      packageList: [
        { packageId: "default-pet", isCurrent: true },
        { packageId: "space-cat", isCurrent: false }
      ],
      packageAssets: [
        { asset: "assets/idle.svg", url: "file:///default/assets/idle.svg", name: "idle.svg", ext: ".svg" },
        { asset: "assets/click.svg", url: "file:///default/assets/click.svg", name: "click.svg", ext: ".svg" },
        { asset: "assets/wave.webm", url: "file:///default/assets/wave.webm", name: "wave.webm", ext: ".webm" }
      ],
      selectedPackageAsset: "assets/click.svg",
      packageEditMode: true,
      assetEditMode: true
    }, config);

    expect(html).toContain("default-pet");
    expect(html).toContain("data-action=\"switch-package\"");
    expect(html).toContain("data-action=\"export-package\"");
    expect(html).toContain("data-action=\"start-new-package\"");
    expect(html).toContain("data-action=\"toggle-package-edit\"");
    expect(html).toContain('data-action="delete-package"');
    expect(html).not.toContain('data-package-id="default-pet">Delete</button>');
    expect(html).toContain("Current");
    expect(html).toContain('id="asset-import-name"');
    expect(html).not.toContain('id="asset-package-id"');
    expect(html).toContain('src="file:///default/assets/idle.svg"');
    expect(html).toContain('src="file:///default/assets/wave.webm"');
    expect(html).toContain("<video");
    expect(html).toContain('preload="metadata"');
    expect(html).toContain('data-action="select-package-asset"');
    expect(html).toContain('data-action="delete-package-asset"');
    expect(html).toContain("Click reaction");
  });

  it("derives direct animation and indirect rule references for package assets", () => {
    expect(getAssetReferences("assets/click.svg", config)).toEqual([
      "Animation: click",
      "Rule: Click reaction -> click"
    ]);
    expect(getAssetReferences("assets/idle.svg", config)).toEqual([
      "Animation: idle (default)"
    ]);
  });
});
