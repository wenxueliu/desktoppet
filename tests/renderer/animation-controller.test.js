import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnimationController } from "../../src/renderer/pet/animation-controller.js";

describe("AnimationController", () => {
  let renderer;
  let controller;

  beforeEach(() => {
    renderer = {
      renderClip: vi.fn(),
      onClipEnd: vi.fn()
    };
  });

  describe("constructor", () => {
    it("should create instance with default animation", () => {
      const config = {
        default: {
          id: "idle",
          asset: "idle.gif"
        }
      };

      controller = new AnimationController(config, renderer);

      expect(controller).toBeDefined();
      expect(controller.getCurrentState()).toBe("default");
      expect(controller.getCurrentClip().id).toBe("idle");
    });

    it("should throw error if default animation missing", () => {
      expect(() => {
        new AnimationController({}, renderer);
      }).toThrow("Default animation is required");
    });

    it("should throw error if renderer.renderClip missing", () => {
      const config = {
        default: { id: "idle", asset: "idle.gif" }
      };

      expect(() => {
        new AnimationController(config, {});
      }).toThrow("renderer.renderClip function is required");
    });

    it("should load animation clips from config", () => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "jump", asset: "jump.webm", type: "oneshot" },
          { id: "run", asset: "run.webm", type: "loop" }
        ]
      };

      controller = new AnimationController(config, renderer);

      expect(controller.hasClip("idle")).toBe(true);
      expect(controller.hasClip("jump")).toBe(true);
      expect(controller.hasClip("run")).toBe(true);
    });

    it("should default clip type to oneshot", () => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "wave", asset: "wave.webm" } // No type specified
        ]
      };

      controller = new AnimationController(config, renderer);

      const clip = controller.getClip("wave");
      expect(clip.type).toBe("oneshot");
    });

    it("should scrub keyframe clips through renderer progress", () => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "look", asset: "look.mp4", type: "keyframe" }
        ]
      };
      renderer.setProgress = vi.fn(() => true);
      controller = new AnimationController(config, renderer);

      expect(controller.setKeyframeProgress("look", 0.25)).toBe(true);
      expect(renderer.renderClip).toHaveBeenCalledWith("look.mp4", {
        keyframe: true,
        progress: 0.25,
        clipId: "look"
      });
      expect(controller.getCurrentState()).toBe("playing-keyframe");

      expect(controller.setKeyframeProgress("look", 0.75)).toBe(true);
      expect(renderer.setProgress).toHaveBeenCalledWith(0.75);
    });

    it("should pass green screen settings to renderer for video clips", () => {
      const greenScreen = { enabled: true, color: "#00ff00", tolerance: 0.35, softness: 0.08 };
      const config = {
        default: { id: "idle", asset: "idle.mp4", greenScreen },
        clips: [
          { id: "wave", asset: "wave.mp4", type: "loop", greenScreen }
        ]
      };
      controller = new AnimationController(config, renderer);

      expect(controller.playAnimation("wave")).toBe(true);
      expect(renderer.renderClip).toHaveBeenCalledWith("wave.mp4", {
        loop: true,
        durationMs: undefined,
        greenScreen
      });

      controller.returnToDefault();
      expect(renderer.renderClip).toHaveBeenLastCalledWith("idle.mp4", {
        loop: true,
        greenScreen
      });
    });
  });

  describe("playAnimation", () => {
    beforeEach(() => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "jump", asset: "jump.webm", type: "oneshot", durationMs: 500 },
          { id: "run", asset: "run.webm", type: "loop" }
        ]
      };
      controller = new AnimationController(config, renderer);
    });

    it("should play oneshot animation", () => {
      const result = controller.playAnimation("jump");

      expect(result).toBe(true);
      expect(renderer.renderClip).toHaveBeenCalledWith("jump.webm", {
        loop: false,
        durationMs: 500
      });
      expect(controller.getCurrentState()).toBe("playing-oneshot");
      expect(controller.getCurrentClip().id).toBe("jump");
    });

    it("should play loop animation", () => {
      const result = controller.playAnimation("run");

      expect(result).toBe(true);
      expect(renderer.renderClip).toHaveBeenCalledWith("run.webm", {
        loop: true,
        durationMs: undefined
      });
      expect(controller.getCurrentState()).toBe("playing-loop");
    });

    it("should return false for non-existent clip", () => {
      const result = controller.playAnimation("nonexistent");

      expect(result).toBe(false);
      expect(renderer.renderClip).not.toHaveBeenCalled();
    });

    it("should return false for empty clipId", () => {
      const result = controller.playAnimation("");

      expect(result).toBe(false);
    });

    it("should override clip options", () => {
      controller.playAnimation("jump", {
        loop: true,
        durationMs: 1000
      });

      expect(renderer.renderClip).toHaveBeenCalledWith("jump.webm", {
        loop: true,
        durationMs: 1000
      });
    });

    it("should return to default after oneshot completes", () => {
      vi.useFakeTimers();

      controller.playAnimation("jump");
      expect(controller.getCurrentState()).toBe("playing-oneshot");

      // Fast-forward time
      vi.advanceTimersByTime(500);

      expect(controller.getCurrentState()).toBe("default");
      expect(controller.getCurrentClip().id).toBe("idle");
      expect(renderer.renderClip).toHaveBeenCalledWith("idle.gif", { loop: true });

      vi.useRealTimers();
    });

    it("should not return to default for loop animation", () => {
      vi.useFakeTimers();

      controller.playAnimation("run");
      expect(controller.getCurrentState()).toBe("playing-loop");

      // Fast-forward time
      vi.advanceTimersByTime(5000);

      // Should still be playing loop
      expect(controller.getCurrentState()).toBe("playing-loop");

      vi.useRealTimers();
    });

    it("should cancel previous oneshot timer when playing new animation", () => {
      vi.useFakeTimers();

      controller.playAnimation("jump"); // 500ms duration
      vi.advanceTimersByTime(200); // Advance 200ms

      controller.playAnimation("jump"); // Play again
      vi.advanceTimersByTime(400); // Advance 400ms (600ms total from first)

      // First timer should be cancelled, still playing second
      expect(controller.getCurrentState()).toBe("playing-oneshot");

      vi.advanceTimersByTime(100); // Complete second animation

      expect(controller.getCurrentState()).toBe("default");

      vi.useRealTimers();
    });

    it("should queue a new animation while a oneshot is still playing", () => {
      vi.useFakeTimers();

      controller.playAnimation("jump"); // oneshot 500ms
      renderer.renderClip.mockClear();

      // 播放中来第二个动画 -> 进等待区，active 不变
      const result = controller.playAnimation("run");
      expect(result).toBe(true);
      expect(controller.getCurrentClip().id).toBe("jump");
      expect(controller.getCurrentState()).toBe("playing-oneshot");
      expect(renderer.renderClip).not.toHaveBeenCalled();

      // jump 播完 -> 播放等待区的 run
      vi.advanceTimersByTime(500);
      expect(controller.getCurrentClip().id).toBe("run");
      expect(controller.getCurrentState()).toBe("playing-loop");

      vi.useRealTimers();
    });
  });

  describe("stopAnimation", () => {
    beforeEach(() => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "jump", asset: "jump.webm", type: "oneshot" },
          { id: "run", asset: "run.webm", type: "loop" }
        ]
      };
      controller = new AnimationController(config, renderer);
    });

    it("should stop loop animation and return to default", () => {
      controller.playAnimation("run");
      expect(controller.getCurrentState()).toBe("playing-loop");

      controller.stopAnimation();

      expect(controller.getCurrentState()).toBe("default");
      expect(controller.getCurrentClip().id).toBe("idle");
    });

    it("should stop oneshot animation and return to default", () => {
      vi.useFakeTimers();

      controller.playAnimation("jump");
      expect(controller.getCurrentState()).toBe("playing-oneshot");

      controller.stopAnimation();

      expect(controller.getCurrentState()).toBe("default");

      // Should not auto-return after original duration
      vi.advanceTimersByTime(1000);
      expect(controller.getCurrentState()).toBe("default");

      vi.useRealTimers();
    });

    it("should do nothing if already at default", () => {
      expect(controller.getCurrentState()).toBe("default");

      controller.stopAnimation();

      expect(controller.getCurrentState()).toBe("default");
    });
  });

  describe("state queries", () => {
    beforeEach(() => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "jump", asset: "jump.webm", type: "oneshot" },
          { id: "run", asset: "run.webm", type: "loop" }
        ]
      };
      controller = new AnimationController(config, renderer);
    });

    it("should report isPlaying correctly", () => {
      expect(controller.isPlaying()).toBe(false);

      controller.playAnimation("jump");
      expect(controller.isPlaying()).toBe(true);

      controller.stopAnimation();
      expect(controller.isPlaying()).toBe(false);
    });

    it("should report isPlayingOneshot correctly", () => {
      expect(controller.isPlayingOneshot()).toBe(false);

      controller.playAnimation("jump");
      expect(controller.isPlayingOneshot()).toBe(true);

      controller.playAnimation("run");
      expect(controller.isPlayingOneshot()).toBe(false);
    });

    it("should report isPlayingLoop correctly", () => {
      expect(controller.isPlayingLoop()).toBe(false);

      controller.playAnimation("run");
      expect(controller.isPlayingLoop()).toBe(true);

      controller.playAnimation("jump");
      expect(controller.isPlayingLoop()).toBe(false);
    });
  });

  describe("clip queries", () => {
    beforeEach(() => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "jump", asset: "jump.webm", type: "oneshot" },
          { id: "run", asset: "run.webm", type: "loop" }
        ]
      };
      controller = new AnimationController(config, renderer);
    });

    it("should check if clip exists", () => {
      expect(controller.hasClip("idle")).toBe(true);
      expect(controller.hasClip("jump")).toBe(true);
      expect(controller.hasClip("nonexistent")).toBe(false);
    });

    it("should get clip by ID", () => {
      const clip = controller.getClip("jump");

      expect(clip).toBeDefined();
      expect(clip.id).toBe("jump");
      expect(clip.asset).toBe("jump.webm");
      expect(clip.type).toBe("oneshot");
    });

    it("should return null for non-existent clip", () => {
      const clip = controller.getClip("nonexistent");

      expect(clip).toBeNull();
    });

    it("should get all clip IDs", () => {
      const ids = controller.getClipIds();

      expect(ids).toContain("idle");
      expect(ids).toContain("jump");
      expect(ids).toContain("run");
      expect(ids.length).toBe(3);
    });

    it("should get all clips", () => {
      const clips = controller.getAllClips();

      expect(clips.length).toBe(3);
      expect(clips.find(c => c.id === "idle")).toBeDefined();
      expect(clips.find(c => c.id === "jump")).toBeDefined();
      expect(clips.find(c => c.id === "run")).toBeDefined();
    });

    it("should return copy of clip, not reference", () => {
      const clip1 = controller.getClip("jump");
      const clip2 = controller.getClip("jump");

      expect(clip1).not.toBe(clip2);
      expect(clip1).toEqual(clip2);
    });
  });

  describe("updateConfig", () => {
    beforeEach(() => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "jump", asset: "jump.webm", type: "oneshot" }
        ]
      };
      controller = new AnimationController(config, renderer);
    });

    it("should update clips", () => {
      const newConfig = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "wave", asset: "wave.webm", type: "oneshot" },
          { id: "spin", asset: "spin.webm", type: "loop" }
        ]
      };

      controller.updateConfig(newConfig);

      expect(controller.hasClip("jump")).toBe(false);
      expect(controller.hasClip("wave")).toBe(true);
      expect(controller.hasClip("spin")).toBe(true);
    });

    it("should update default animation", () => {
      const newConfig = {
        default: { id: "new-idle", asset: "new-idle.gif" },
        clips: []
      };

      controller.updateConfig(newConfig);

      expect(controller.getClip("new-idle")).toBeDefined();
      expect(controller.getClip("new-idle").asset).toBe("new-idle.gif");
    });

    it("should return to default if current clip removed", () => {
      controller.playAnimation("jump");
      expect(controller.getCurrentClip().id).toBe("jump");

      const newConfig = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [] // Remove jump
      };

      controller.updateConfig(newConfig);

      expect(controller.getCurrentState()).toBe("default");
      expect(controller.getCurrentClip().id).toBe("idle");
    });

    it("should keep playing if current clip still exists", () => {
      controller.playAnimation("jump");

      const newConfig = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "jump", asset: "jump-updated.webm", type: "oneshot" }
        ]
      };

      controller.updateConfig(newConfig);

      // State should remain (clip ID still exists)
      expect(controller.getCurrentState()).toBe("playing-oneshot");
    });
  });

  describe("destroy", () => {
    it("should cleanup resources", () => {
      vi.useFakeTimers();

      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "jump", asset: "jump.webm", type: "oneshot", durationMs: 500 }
        ]
      };
      controller = new AnimationController(config, renderer);

      controller.playAnimation("jump");
      controller.destroy();

      // Timer should be cleared
      vi.advanceTimersByTime(1000);
      // No error should occur

      expect(controller.getCurrentClip()).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("integration scenarios", () => {
    beforeEach(() => {
      const config = {
        default: { id: "idle", asset: "idle.gif" },
        clips: [
          { id: "click", asset: "click.webm", type: "oneshot", durationMs: 800 },
          { id: "drag", asset: "drag.webm", type: "loop" },
          { id: "wave", asset: "wave.webm", type: "oneshot", durationMs: 1200 }
        ]
      };
      controller = new AnimationController(config, renderer);
    });

    it("should handle click -> drag -> stop sequence", () => {
      // Click plays oneshot
      controller.playAnimation("click");
      expect(controller.isPlayingOneshot()).toBe(true);

      // Drag interrupts and plays loop
      controller.playAnimation("drag");
      expect(controller.isPlayingLoop()).toBe(true);

      // Stop returns to idle
      controller.stopAnimation();
      expect(controller.getCurrentState()).toBe("default");
    });

    it("should handle rapid animation switches", () => {
      controller.playAnimation("click");
      controller.playAnimation("wave");
      controller.playAnimation("drag");

      expect(controller.getCurrentClip().id).toBe("drag");
      expect(controller.isPlayingLoop()).toBe(true);
    });

    it("should handle oneshot -> oneshot sequence", () => {
      vi.useFakeTimers();

      controller.playAnimation("click"); // 800ms
      vi.advanceTimersByTime(400); // Half way

      controller.playAnimation("wave"); // 1200ms
      vi.advanceTimersByTime(1200); // Complete second

      expect(controller.getCurrentState()).toBe("default");

      vi.useRealTimers();
    });
  });
});
