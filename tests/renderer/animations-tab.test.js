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
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: [
          { id: "40000000-0000-4000-8000-000000000002", name: "Click", asset: "assets/click.svg", type: "oneshot", durationMs: 900 }
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
    expect(html).toContain("Animation name");
    expect(html).not.toContain("Animation ID (letters, numbers, - and _)");
    expect(html).not.toContain("Choose an asset from the current pet package.");
    expect(html).not.toContain("How long the animation plays");
    expect(html).toContain('value=""');
    expect(html).not.toContain('id="anim-id"');
  });

  it("renders duration hidden for loop animations so type switching can reveal it", () => {
    const html = renderAnimations({
      selectedClipId: "40000000-0000-4000-8000-000000000003",
      packageAssets: [
        { asset: "assets/drag.svg", name: "drag.svg" }
      ]
    }, {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: [
          { id: "40000000-0000-4000-8000-000000000003", name: "Drag", asset: "assets/drag.svg", type: "loop" }
        ]
      }
    });

    expect(html).toContain('option value="loop" selected');
    expect(html).toContain('data-role="animation-duration" hidden');
    expect(html).toContain('id="anim-duration"');
  });

  it("includes media metadata on asset options for duration autofill", () => {
    const html = renderAnimations({
      selectedClipId: "",
      packageAssets: [
        {
          asset: "assets/wave.gif",
          name: "wave.gif",
          ext: ".gif",
          url: "file:///pets/wave.gif",
          durationMs: 2400
        }
      ]
    }, {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: []
      }
    });

    expect(html).toContain('data-ext=".gif"');
    expect(html).toContain('data-url="file:///pets/wave.gif"');
    expect(html).toContain('data-duration-ms="2400"');
    expect(html).toContain('id="anim-duration"');
    expect(html).toContain('value="900"');
  });

  it("prefills duration from media metadata when editing a oneshot without explicit duration", () => {
    const html = renderAnimations({
      selectedClipId: "40000000-0000-4000-8000-000000000002",
      packageAssets: [
        { asset: "assets/wave.gif", name: "wave.gif", ext: ".gif", durationMs: 2400 }
      ]
    }, {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: [
          { id: "40000000-0000-4000-8000-000000000002", name: "Wave", asset: "assets/wave.gif", type: "oneshot" }
        ]
      }
    });

    expect(html).toContain('id="anim-duration"');
    expect(html).toContain('value="2400"');
  });
});
