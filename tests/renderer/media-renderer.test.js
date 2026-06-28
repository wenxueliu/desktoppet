import { describe, expect, it, vi } from "vitest";
import {
  createPetMediaRenderer,
  getAssetExtension,
  isVideoAsset
} from "../../src/renderer/pet/media-renderer";

function createMediaElements() {
  const container = { dataset: {} };
  const image = {
    hidden: false,
    src: "",
    removeAttribute: vi.fn((name) => {
      if (name === "src") image.src = "";
    })
  };
  const video = {
    dataset: {},
    hidden: true,
    muted: false,
    playsInline: false,
    loop: false,
    src: "",
    readyState: 1,
    duration: 4,
    currentTime: 0,
    onloadedmetadata: null,
    pause: vi.fn(),
    load: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    removeAttribute: vi.fn((name) => {
      if (name === "src") video.src = "";
    })
  };
  return { container, image, video };
}

describe("pet media renderer", () => {
  it("detects video assets from paths and file URLs", () => {
    expect(getAssetExtension("assets/wave.MP4?cache=1")).toBe(".mp4");
    expect(getAssetExtension("file:///pets/idle.svg")).toBe(".svg");
    expect(isVideoAsset("file:///pets/wave.webm")).toBe(true);
    expect(isVideoAsset("file:///pets/wave.MOV?v=1")).toBe(true);
    expect(isVideoAsset("assets/wave.gif")).toBe(false);
  });

  it("renders videos through the video element and passes loop playback", () => {
    const elements = createMediaElements();
    const renderer = createPetMediaRenderer(elements);

    expect(renderer.render("file:///pets/wave.mp4", { state: "wave", loop: true })).toBe("video");

    expect(elements.container.dataset).toEqual({
      state: "wave",
      asset: "file:///pets/wave.mp4"
    });
    expect(elements.image.hidden).toBe(true);
    expect(elements.image.removeAttribute).toHaveBeenCalledWith("src");
    expect(elements.video.hidden).toBe(false);
    expect(elements.video.muted).toBe(true);
    expect(elements.video.playsInline).toBe(true);
    expect(elements.video.loop).toBe(true);
    expect(elements.video.src).toBe("file:///pets/wave.mp4");
    expect(elements.video.load).toHaveBeenCalledOnce();
    expect(elements.video.play).toHaveBeenCalledOnce();
  });

  it("stops video playback when switching back to an image asset", () => {
    const elements = createMediaElements();
    const renderer = createPetMediaRenderer(elements);

    renderer.render("file:///pets/wave.mp4", { state: "wave", loop: false });
    renderer.render("file:///pets/idle.svg", { state: "idle", loop: true });

    expect(elements.video.pause).toHaveBeenCalledOnce();
    expect(elements.video.removeAttribute).toHaveBeenCalledWith("src");
    expect(elements.video.hidden).toBe(true);
    expect(elements.video.loop).toBe(false);
    expect(elements.image.hidden).toBe(false);
    expect(elements.image.src).toBe("file:///pets/idle.svg");
    expect(renderer.getCurrentAsset()).toBe("file:///pets/idle.svg");
  });

  it("scrubs keyframe videos by normalized progress", () => {
    const elements = createMediaElements();
    const renderer = createPetMediaRenderer(elements);

    expect(renderer.render("file:///pets/look.mp4", {
      state: "look",
      keyframe: true,
      progress: 0.25
    })).toBe("keyframe-video");

    expect(elements.video.hidden).toBe(false);
    expect(elements.video.loop).toBe(false);
    expect(elements.video.pause).toHaveBeenCalledOnce();
    expect(elements.video.currentTime).toBe(1);

    expect(renderer.setProgress(0.75)).toBe(true);
    expect(elements.video.currentTime).toBe(3);
  });

  it("queues the latest keyframe video progress while a seek is already in flight", () => {
    const elements = createMediaElements();
    const renderer = createPetMediaRenderer(elements);

    renderer.render("file:///pets/look.mp4", {
      state: "look",
      keyframe: true,
      progress: 0.25
    });

    elements.video.seeking = true;
    expect(renderer.setProgress(0.75)).toBe(true);
    expect(elements.video.currentTime).toBe(1);
    expect(elements.video.dataset.pendingKeyframeTime).toBe("3");

    elements.video.seeking = false;
    elements.video.onseeked();
    expect(elements.video.currentTime).toBe(3);
  });
});
