const VIDEO_ASSET_EXTENSIONS = new Set([".webm", ".mp4", ".mov"]);
const GIF_ASSET_EXTENSION = ".gif";

export function getAssetExtension(asset) {
  const rawValue = String(asset || "");
  let pathname = rawValue;
  try {
    pathname = new URL(rawValue).pathname;
  } catch (_error) {
    pathname = rawValue.split(/[?#]/)[0];
  }

  const filename = pathname.split(/[\\/]/).filter(Boolean).pop() || "";
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

export function isVideoAsset(asset) {
  return VIDEO_ASSET_EXTENSIONS.has(getAssetExtension(asset));
}

export function isGifAsset(asset) {
  return getAssetExtension(asset) === GIF_ASSET_EXTENSION;
}

function clearImage(image) {
  if (!image) return;
  if (typeof image.removeAttribute === "function") {
    image.removeAttribute("src");
  } else {
    image.src = "";
  }
}

function stopVideo(video) {
  if (!video) return;
  if (typeof video.pause === "function") video.pause();
  if (typeof video.removeAttribute === "function") {
    video.removeAttribute("src");
  } else {
    video.src = "";
  }
  video.loop = false;
  video.hidden = true;
  if (typeof video.load === "function") video.load();
}

function clearCanvas(canvas) {
  if (!canvas) return;
  const context = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (context && canvas.width && canvas.height) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.hidden = true;
}

function playVideo(video) {
  if (!video || typeof video.play !== "function") return;
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function clampProgress(progress) {
  const value = Number(progress);
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function setVideoProgress(video, progress) {
  if (!video) return;
  const nextProgress = clampProgress(progress);
  if (video.dataset) {
    video.dataset.keyframeProgress = String(nextProgress);
  }

  const applySeek = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const nextTime = Math.min(video.duration, Math.max(0, video.duration * nextProgress));
    if (!Number.isFinite(nextTime)) return;
    if (video.dataset) {
      video.dataset.pendingKeyframeTime = String(nextTime);
    }
    scheduleVideoSeek(video);
  };

  if (video.readyState >= 1) {
    applySeek();
  } else {
    video.onloadedmetadata = applySeek;
  }
}

function scheduleVideoSeek(video) {
  if (!video || !video.dataset) return;

  const seekToPending = () => {
    const nextTime = Number(video.dataset.pendingKeyframeTime);
    if (!Number.isFinite(nextTime)) return;

    const currentTime = Number(video.currentTime);
    if (Number.isFinite(currentTime) && Math.abs(currentTime - nextTime) < 0.001) {
      delete video.dataset.pendingKeyframeTime;
      return;
    }

    video.currentTime = nextTime;
  };

  if (video.seeking) {
    if (video.dataset.keyframeSeekQueued === "1") return;
    video.dataset.keyframeSeekQueued = "1";
    video.onseeked = () => {
      if (video.dataset) {
        delete video.dataset.keyframeSeekQueued;
      }
      seekToPending();
    };
    return;
  }

  seekToPending();
}

function createGifFrameSnapshots(frames, width, height) {
  if (typeof document === "undefined") return [];

  const workCanvas = document.createElement("canvas");
  workCanvas.width = width;
  workCanvas.height = height;
  const workContext = workCanvas.getContext("2d");
  if (!workContext) return [];

  return frames.map((frame) => {
    const previousImageData = frame.disposalType === 3
      ? workContext.getImageData(0, 0, width, height)
      : null;
    const patch = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
    workContext.putImageData(patch, frame.dims.left, frame.dims.top);
    const imageData = workContext.getImageData(0, 0, width, height);

    if (frame.disposalType === 2) {
      workContext.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    } else if (frame.disposalType === 3 && previousImageData) {
      workContext.putImageData(previousImageData, 0, 0);
    }

    return {
      imageData,
      delayMs: Math.max(0, Number(frame.delay || 0))
    };
  });
}

async function decodeGifFrames(asset) {
  if (!asset) return null;
  const gifuct = await import("gifuct-js");
  const { parseGIF, decompressFrames } = gifuct;

  const response = await fetch(asset);
  const buffer = await response.arrayBuffer();
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  const width = gif.lsd.width;
  const height = gif.lsd.height;

  return {
    width,
    height,
    frames: createGifFrameSnapshots(frames, width, height)
  };
}

function getFrameIndexForProgress(frameCount, progress) {
  if (frameCount <= 1) return 0;
  return Math.min(frameCount - 1, Math.floor(clampProgress(progress) * frameCount));
}

function drawGifProgress(canvas, decodedGif, progress) {
  if (!canvas || !decodedGif || decodedGif.frames.length === 0) return;
  const context = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!context) return;

  if (canvas.width !== decodedGif.width) canvas.width = decodedGif.width;
  if (canvas.height !== decodedGif.height) canvas.height = decodedGif.height;

  const frame = decodedGif.frames[getFrameIndexForProgress(decodedGif.frames.length, progress)];
  context.putImageData(frame.imageData, 0, 0);
}

export function createPetMediaRenderer({ container, image, video, canvas } = {}) {
  const gifCache = new Map();
  const gifDecodes = new Map();
  let gifRenderToken = 0;

  return {
    render(asset, { state = "", loop = false, keyframe = false, progress = 0 } = {}) {
      if (container && container.dataset) {
        container.dataset.state = state;
        container.dataset.asset = asset || "";
      }

      if (keyframe && isVideoAsset(asset)) {
        clearImage(image);
        if (image) image.hidden = true;
        clearCanvas(canvas);
        if (video) {
          video.hidden = false;
          video.muted = true;
          video.playsInline = true;
          video.loop = false;
          if (video.src !== asset) {
            video.src = asset;
            if (typeof video.load === "function") video.load();
          }
          if (typeof video.pause === "function") video.pause();
          setVideoProgress(video, progress);
        }
        return "keyframe-video";
      }

      if (keyframe && isGifAsset(asset)) {
        clearImage(image);
        if (image) image.hidden = true;
        stopVideo(video);
        if (canvas) canvas.hidden = false;

        const token = ++gifRenderToken;
        const draw = (decodedGif) => {
          if (token !== gifRenderToken) return;
          drawGifProgress(canvas, decodedGif, progress);
        };

        if (gifCache.has(asset)) {
          draw(gifCache.get(asset));
        } else {
          if (!gifDecodes.has(asset)) {
            gifDecodes.set(asset, decodeGifFrames(asset)
              .then((decodedGif) => {
                gifCache.set(asset, decodedGif);
                gifDecodes.delete(asset);
                return decodedGif;
              })
              .catch((error) => {
                gifDecodes.delete(asset);
                throw error;
              }));
          }

          gifDecodes.get(asset)
            .then((decodedGif) => {
              draw(decodedGif);
            })
            .catch(() => {
              if (token === gifRenderToken) clearCanvas(canvas);
            });
        }
        return "keyframe-gif";
      }

      if (isVideoAsset(asset)) {
        clearCanvas(canvas);
        clearImage(image);
        if (image) image.hidden = true;
        if (video) {
          video.hidden = false;
          video.muted = true;
          video.playsInline = true;
          video.loop = Boolean(loop);
          video.onloadedmetadata = null;
          video.src = asset;
          if (typeof video.load === "function") video.load();
          playVideo(video);
        }
        return "video";
      }

      stopVideo(video);
      clearCanvas(canvas);
      if (image) {
        image.hidden = false;
        image.src = asset || "";
      }
      return "image";
    },

    setProgress(progress) {
      const asset = (container && container.dataset && container.dataset.asset) || "";
      if (isVideoAsset(asset)) {
        setVideoProgress(video, progress);
        return true;
      }

      if (isGifAsset(asset) && gifCache.has(asset)) {
        drawGifProgress(canvas, gifCache.get(asset), progress);
        return true;
      }

      return false;
    },

    getCurrentAsset() {
      return (container && container.dataset && container.dataset.asset) || "";
    }
  };
}
