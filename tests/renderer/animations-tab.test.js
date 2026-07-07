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

  it("renders keyframe animations without a visible duration field", () => {
    const html = renderAnimations({
      selectedClipId: "40000000-0000-4000-8000-000000000004",
      packageAssets: [
        { asset: "assets/look.mp4", name: "look.mp4" }
      ]
    }, {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: [
          { id: "40000000-0000-4000-8000-000000000004", name: "Look", asset: "assets/look.mp4", type: "keyframe" }
        ]
      }
    });

    expect(html).toContain('option value="keyframe" selected');
    expect(html).toContain('data-role="animation-duration" hidden');
    expect(html).toContain("Keyframe Animation");
  });

  it("renders keyframe settings immediately from an unsaved animation draft", () => {
    const html = renderAnimations({
      selectedClipId: "",
      animationDraft: {
        selectedClipId: "",
        clip: {
          id: "",
          name: "Look",
          asset: "assets/look.webm",
          type: "keyframe"
        }
      },
      packageAssets: [
        { asset: "assets/look.webm", name: "look.webm" }
      ]
    }, {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: []
      }
    });

    expect(html).toContain('option value="keyframe" selected');
    expect(html).toContain("Keyframe settings");
    expect(html).toContain('data-action="open-keyframe-editor" data-clip-id=""');
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

  it("renders a canvas-backed live preview for selected video animations", () => {
    const html = renderAnimations({
      selectedClipId: "40000000-0000-4000-8000-000000000004",
      packageAssets: [
        { asset: "assets/look.mp4", name: "look.mp4", url: "file:///pets/look.mp4" }
      ]
    }, {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: [
          {
            id: "40000000-0000-4000-8000-000000000004",
            name: "Look",
            asset: "assets/look.mp4",
            type: "loop",
            greenScreen: { enabled: true, color: "#00ff00", tolerance: 0.35, softness: 0.08 }
          }
        ]
      }
    });

    expect(html).toContain('id="animation-preview-video" class="animation-preview-media keyframe-preview-source"');
    expect(html).toContain('id="animation-preview-canvas" class="animation-preview-media" hidden');
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

  it("renders green screen settings only for video animation assets", () => {
    const config = {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: [
          {
            id: "40000000-0000-4000-8000-000000000005",
            name: "Green",
            asset: "assets/green.mp4",
            type: "loop",
            greenScreen: { enabled: true, color: "#11ff22", tolerance: 0.4, softness: 0.12 }
          }
        ]
      }
    };

    const videoHtml = renderAnimations({
      selectedClipId: "40000000-0000-4000-8000-000000000005",
      packageAssets: [{ asset: "assets/green.mp4", name: "green.mp4", ext: ".mp4" }]
    }, config);

    expect(videoHtml).toContain('data-role="green-screen-settings"');
    expect(videoHtml).toContain('name="greenScreenEnabled"');
    expect(videoHtml).toContain('name="greenScreenColor" value="#11ff22"');
    expect(videoHtml).toContain('name="greenScreenTolerance" value="40"');
    expect(videoHtml).toContain('name="greenScreenSoftness" value="12"');

    const imageHtml = renderAnimations({
      selectedClipId: "40000000-0000-4000-8000-000000000001",
      packageAssets: [{ asset: "assets/idle.svg", name: "idle.svg", ext: ".svg" }]
    }, config);

    expect(imageHtml).not.toContain('data-role="green-screen-settings"');
  });

  it("hides the live green-screen toggle for keyframe video clips and shows a bake area instead", () => {
    const config = {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: [
          {
            id: "40000000-0000-4000-8000-000000000006",
            name: "Look",
            asset: "assets/look.mp4",
            type: "keyframe",
            greenScreen: { enabled: true, color: "#019d5f", tolerance: 0.22, softness: 0.08 }
          }
        ]
      }
    };

    const html = renderAnimations({
      selectedClipId: "40000000-0000-4000-8000-000000000006",
      packageAssets: [{ asset: "assets/look.mp4", name: "look.mp4", ext: ".mp4" }]
    }, config);

    // No live runtime keying toggle for keyframe clips.
    expect(html).not.toContain('name="greenScreenEnabled"');
    // Bake area with key params + bake button is present.
    expect(html).toContain('data-role="green-screen-bake"');
    expect(html).toContain('data-action="bake-green-screen"');
    expect(html).toContain('name="greenScreenColor" value="#019d5f"');
    expect(html).toContain('name="greenScreenTolerance" value="22"');
  });

  it("shows an 'already transparent' notice for keyframe webm clips instead of a bake area", () => {
    const config = {
      animations: {
        default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
        clips: [
          { id: "40000000-0000-4000-8000-000000000007", name: "Look", asset: "assets/look.webm", type: "keyframe" }
        ]
      }
    };

    const html = renderAnimations({
      selectedClipId: "40000000-0000-4000-8000-000000000007",
      packageAssets: [{ asset: "assets/look.webm", name: "look.webm", ext: ".webm" }]
    }, config);

    expect(html).not.toContain('data-action="bake-green-screen"');
    expect(html).not.toContain('name="greenScreenEnabled"');
    expect(html).toContain('data-role="green-screen-settings"');
  });
});

it("renders keyframe settings modal with default keyframes and preview area", () => {
  const html = renderAnimations({
    selectedClipId: "40000000-0000-4000-8000-000000000004",
    keyframeEditorOpen: true,
    keyframeEditorClipId: "40000000-0000-4000-8000-000000000004",
    keyframeEditorKeyframes: [],
    keyframeEditorAssetUrl: "file:///pets/look.mp4",
    keyframeEditorAssetPath: "assets/look.mp4",
    packageAssets: [
      { asset: "assets/look.mp4", name: "look.mp4", url: "file:///pets/look.mp4" }
    ]
  }, {
    animations: {
      default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
      clips: [
        { id: "40000000-0000-4000-8000-000000000004", name: "Look", asset: "assets/look.mp4", type: "keyframe" }
      ]
    }
  });

  expect(html).toContain("Keyframe settings");
  expect(html).toContain("Keyframe Settings");
  expect(html).toContain('data-keyframe-input="0"');
  expect(html).toContain('data-keyframe-input="0.25"');
  expect(html).toContain('data-keyframe-input="0.5"');
  expect(html).toContain('data-keyframe-input="0.75"');
  expect(html).toContain('keyframe-preview-video');
  expect(html).toContain('keyframe-label');
  expect(html).toContain('data-role="keyframe-track"');
  expect(html).not.toContain('data-action="add-keyframe"');
});

it("renders keyframe video green screen preview through a canvas", () => {
  const html = renderAnimations({
    selectedClipId: "40000000-0000-4000-8000-000000000004",
    keyframeEditorOpen: true,
    keyframeEditorClipId: "40000000-0000-4000-8000-000000000004",
    keyframeEditorKeyframes: [],
    keyframeEditorAssetUrl: "file:///pets/look.mp4",
    keyframeEditorAssetPath: "assets/look.mp4",
    keyframeEditorGreenScreen: { enabled: true, color: "#00ff00", tolerance: 0.35, softness: 0.08 },
    packageAssets: [
      { asset: "assets/look.mp4", name: "look.mp4", url: "file:///pets/look.mp4" }
    ]
  }, {
    animations: {
      default: { id: "40000000-0000-4000-8000-000000000001", name: "Idle", asset: "assets/idle.svg" },
      clips: [
        { id: "40000000-0000-4000-8000-000000000004", name: "Look", asset: "assets/look.mp4", type: "keyframe" }
      ]
    }
  });

  expect(html).toContain('id="keyframe-preview-video" class="keyframe-preview-source"');
  expect(html).toContain('id="keyframe-preview-green-screen" class="keyframe-preview-media"');
});
