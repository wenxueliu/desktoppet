import { describe, expect, it } from "vitest";
import { renderAnimations } from "../../src/renderer/panel/tabs/animations";

describe("animations tab", () => {
  it("renders an empty editable form when adding a new animation", () => {
    const html = renderAnimations({
      selectedClipId: "",
      packageAssets: [
        { asset: "assets/idle.svg", name: "idle.svg" },
        { asset: "assets/click.svg", name: "click.svg" }
      ]
    }, {
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: [
          { id: "click", asset: "assets/click.svg", type: "oneshot", durationMs: 900 }
        ]
      }
    });

    expect(html).toContain('name="clipId" value=""');
    expect(html).toContain('name="isDefault" value="false"');
    expect(html).toContain('id="anim-type"');
    expect(html).not.toContain('value="default"');
    expect(html).toContain('id="anim-asset"');
    expect(html).toContain('<select id="anim-asset" name="asset" required>');
    expect(html).toContain('value="assets/idle.svg"');
    expect(html).toContain('value="assets/click.svg"');
    expect(html).not.toContain('type="text"\n                  id="anim-asset"');
    expect(html).toContain("Animation System Description");
    expect(html).not.toContain("<details");
    expect(html).toContain('class="item-row asset-row"\n      type="button"\n      data-action="select-animation"');
    expect(html).toContain("Animation ID (letters, numbers, - and _)");
    expect(html).not.toContain("Choose an asset from the current pet package.");
    expect(html).not.toContain("How long the animation plays");
    expect(html).toContain('value=""');
    expect(html).not.toContain('value="idle"\n              required\n              pattern="[a-zA-Z0-9_-]+"\n              readonly');
  });

  it("hides duration for loop animations", () => {
    const html = renderAnimations({
      selectedClipId: "drag",
      packageAssets: [
        { asset: "assets/drag.svg", name: "drag.svg" }
      ]
    }, {
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: [
          { id: "drag", asset: "assets/drag.svg", type: "loop" }
        ]
      }
    });

    expect(html).toContain('option value="loop" selected');
    expect(html).not.toContain('id="anim-duration"');
  });
});
