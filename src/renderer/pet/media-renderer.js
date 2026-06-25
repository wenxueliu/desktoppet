const VIDEO_ASSET_EXTENSIONS = new Set([".webm", ".mp4", ".mov"]);

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

function playVideo(video) {
  if (!video || typeof video.play !== "function") return;
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

export function createPetMediaRenderer({ container, image, video } = {}) {
  return {
    render(asset, { state = "", loop = false } = {}) {
      if (container && container.dataset) {
        container.dataset.state = state;
        container.dataset.asset = asset || "";
      }

      if (isVideoAsset(asset)) {
        clearImage(image);
        if (image) image.hidden = true;
        if (video) {
          video.hidden = false;
          video.muted = true;
          video.playsInline = true;
          video.loop = Boolean(loop);
          video.src = asset;
          if (typeof video.load === "function") video.load();
          playVideo(video);
        }
        return "video";
      }

      stopVideo(video);
      if (image) {
        image.hidden = false;
        image.src = asset || "";
      }
      return "image";
    },

    getCurrentAsset() {
      return (container && container.dataset && container.dataset.asset) || "";
    }
  };
}
