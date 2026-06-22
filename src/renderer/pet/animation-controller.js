/**
 * Animation Controller - Unity-style animation state machine
 *
 * Manages animation playback with three types:
 * - default: Always loops, fallback animation
 * - oneshot: Plays once, automatically returns to default
 * - loop: Loops continuously until manually stopped
 */

/**
 * AnimationController class
 * Manages animation clips and state transitions
 */
class AnimationController {
  /**
   * @param {object} config - Animation configuration
   * @param {object} config.default - Default animation (required)
   * @param {string} config.default.id - Animation ID
   * @param {string} config.default.asset - Asset path or URL
   * @param {Array} config.clips - Animation clips array
   * @param {object} renderer - Rendering callbacks
   * @param {function} renderer.renderClip - Function to render a clip: (asset, options) => void
   * @param {function} renderer.onClipEnd - Register clip end callback: (callback) => void
   */
  constructor(config = {}, renderer = {}) {
    if (!config.default || !config.default.asset) {
      throw new Error('Default animation is required');
    }

    if (typeof renderer.renderClip !== 'function') {
      throw new Error('renderer.renderClip function is required');
    }

    this.defaultClip = {
      id: config.default.id || 'default',
      asset: config.default.asset,
      type: 'default',
      loop: true
    };

    // Build clips map
    this.clips = new Map();
    this.clips.set(this.defaultClip.id, this.defaultClip);

    if (Array.isArray(config.clips)) {
      config.clips.forEach(clip => {
        if (clip && clip.id && clip.asset) {
          this.clips.set(clip.id, {
            id: clip.id,
            asset: clip.asset,
            type: clip.type || 'oneshot', // default to oneshot
            loop: clip.type === 'loop',
            durationMs: clip.durationMs
          });
        }
      });
    }

    this.renderer = renderer;
    this.currentState = 'default';
    this.currentClip = this.defaultClip;
    this.clipEndTimer = null;
  }

  /**
   * Play an animation clip
   * @param {string} clipId - Clip ID to play
   * @param {object} options - Playback options (overrides clip settings)
   * @returns {boolean} true if clip was found and started
   */
  playAnimation(clipId, options = {}) {
    if (!clipId) {
      console.warn('playAnimation: clipId is required');
      return false;
    }

    const clip = this.clips.get(clipId);
    if (!clip) {
      console.warn(`playAnimation: clip not found: ${clipId}`);
      return false;
    }

    // Clear any pending clip end timer
    this.clearClipEndTimer();

    // Merge options with clip settings
    const playOptions = {
      loop: options.loop !== undefined ? options.loop : clip.loop,
      durationMs: options.durationMs || clip.durationMs
    };

    // Update state
    if (clip.type === 'oneshot') {
      this.currentState = 'playing-oneshot';
    } else if (clip.type === 'loop') {
      this.currentState = 'playing-loop';
    } else {
      this.currentState = 'default';
    }

    this.currentClip = clip;

    // Render the clip
    this.renderer.renderClip(clip.asset, playOptions);

    // For oneshot clips, schedule return to default
    if (clip.type === 'oneshot') {
      const duration = playOptions.durationMs || 1000;
      this.clipEndTimer = setTimeout(() => {
        this.returnToDefault();
      }, duration);
    }

    return true;
  }

  /**
   * Stop current animation and return to default
   */
  stopAnimation() {
    if (this.currentState === 'default') {
      return; // Already at default
    }

    this.clearClipEndTimer();
    this.returnToDefault();
  }

  /**
   * Return to default animation
   * @private
   */
  returnToDefault() {
    this.currentState = 'default';
    this.currentClip = this.defaultClip;
    this.renderer.renderClip(this.defaultClip.asset, { loop: true });
  }

  /**
   * Clear clip end timer
   * @private
   */
  clearClipEndTimer() {
    if (this.clipEndTimer) {
      clearTimeout(this.clipEndTimer);
      this.clipEndTimer = null;
    }
  }

  /**
   * Get current animation state
   * @returns {string} 'default' | 'playing-oneshot' | 'playing-loop'
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Get current clip
   * @returns {object|null} Current clip object or null if destroyed
   */
  getCurrentClip() {
    return this.currentClip ? { ...this.currentClip } : null;
  }

  /**
   * Check if a clip exists
   * @param {string} clipId - Clip ID
   * @returns {boolean}
   */
  hasClip(clipId) {
    return this.clips.has(clipId);
  }

  /**
   * Get clip by ID
   * @param {string} clipId - Clip ID
   * @returns {object|null} Clip object or null
   */
  getClip(clipId) {
    const clip = this.clips.get(clipId);
    return clip ? { ...clip } : null;
  }

  /**
   * Get all clip IDs
   * @returns {Array<string>}
   */
  getClipIds() {
    return Array.from(this.clips.keys());
  }

  /**
   * Get all clips
   * @returns {Array<object>}
   */
  getAllClips() {
    return Array.from(this.clips.values()).map(clip => ({ ...clip }));
  }

  /**
   * Check if currently playing (not default)
   * @returns {boolean}
   */
  isPlaying() {
    return this.currentState !== 'default';
  }

  /**
   * Check if currently playing a oneshot animation
   * @returns {boolean}
   */
  isPlayingOneshot() {
    return this.currentState === 'playing-oneshot';
  }

  /**
   * Check if currently playing a loop animation
   * @returns {boolean}
   */
  isPlayingLoop() {
    return this.currentState === 'playing-loop';
  }

  /**
   * Update configuration (reload clips)
   * @param {object} config - New animation configuration
   */
  updateConfig(config) {
    // Update default clip if provided
    if (config.default && config.default.asset) {
      this.defaultClip = {
        id: config.default.id || 'default',
        asset: config.default.asset,
        type: 'default',
        loop: true
      };
      this.clips.set(this.defaultClip.id, this.defaultClip);
    }

    // Rebuild clips map
    if (Array.isArray(config.clips)) {
      // Keep default, clear others
      const newClips = new Map();
      newClips.set(this.defaultClip.id, this.defaultClip);

      config.clips.forEach(clip => {
        if (clip && clip.id && clip.asset) {
          newClips.set(clip.id, {
            id: clip.id,
            asset: clip.asset,
            type: clip.type || 'oneshot',
            loop: clip.type === 'loop',
            durationMs: clip.durationMs
          });
        }
      });

      this.clips = newClips;
    }

    // If current clip no longer exists, return to default
    if (!this.clips.has(this.currentClip.id)) {
      this.returnToDefault();
    }
  }

  /**
   * Destroy controller (cleanup)
   */
  destroy() {
    this.clearClipEndTimer();
    this.clips.clear();
    this.currentClip = null;
    this.currentState = null;
  }
}

// ES module export (primary)
export { AnimationController };

// Export for CommonJS (for tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AnimationController };
}
