const fs = require("node:fs");
const path = require("node:path");
const { SUPPORTED_ASSET_EXTENSIONS } = require("../../shared/schema");
const { isSafeRelativePath } = require("../../shared/path-safety");

const MAX_ASSET_BYTES = 50 * 1024 * 1024;

function getGifColorTableSize(packedByte) {
  return (packedByte & 0x80) ? 3 * (2 ** ((packedByte & 0x07) + 1)) : 0;
}

function skipGifSubBlocks(buffer, offset) {
  let nextOffset = offset;
  while (nextOffset < buffer.length) {
    const blockSize = buffer[nextOffset];
    nextOffset += 1;
    if (blockSize === 0) return nextOffset;
    nextOffset += blockSize;
  }
  return buffer.length;
}

function getGifDurationMs(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 14) return null;
  const signature = buffer.toString("ascii", 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;

  let offset = 13 + getGifColorTableSize(buffer[10]);
  let pendingDelayMs = 0;
  let totalDurationMs = 0;
  let frameCount = 0;

  while (offset < buffer.length) {
    const blockType = buffer[offset];

    if (blockType === 0x3b) break;

    if (blockType === 0x21) {
      const label = buffer[offset + 1];
      if (label === 0xf9 && buffer[offset + 2] === 0x04 && offset + 7 < buffer.length) {
        pendingDelayMs = buffer.readUInt16LE(offset + 4) * 10;
        offset += 8;
        continue;
      }
      offset = skipGifSubBlocks(buffer, offset + 2);
      continue;
    }

    if (blockType === 0x2c) {
      if (offset + 9 >= buffer.length) break;
      const localColorTableSize = getGifColorTableSize(buffer[offset + 9]);
      offset += 10 + localColorTableSize;
      if (offset >= buffer.length) break;
      offset += 1; // LZW minimum code size
      offset = skipGifSubBlocks(buffer, offset);
      totalDurationMs += pendingDelayMs;
      pendingDelayMs = 0;
      frameCount += 1;
      continue;
    }

    break;
  }

  return frameCount > 0 && totalDurationMs > 0 ? totalDurationMs : null;
}

function getAssetDurationMs(filePath, ext = path.extname(filePath).toLowerCase()) {
  if (ext !== ".gif") return null;
  try {
    return getGifDurationMs(fs.readFileSync(filePath));
  } catch (_error) {
    return null;
  }
}

function validateAsset(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return { ok: false, error: "Asset path is required" };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_ASSET_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `Unsupported asset extension: ${ext || "(none)"}` };
  }

  let linkStats;
  let stats;
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    linkStats = fs.lstatSync(filePath);
    if (linkStats.isSymbolicLink()) {
      return { ok: false, error: "Asset path cannot be a symbolic link" };
    }
    stats = fs.statSync(filePath);
  } catch (_error) {
    return { ok: false, error: "Asset file is not readable" };
  }

  if (!stats.isFile()) {
    return { ok: false, error: "Asset path is not a file" };
  }

  if (stats.size > MAX_ASSET_BYTES) {
    return { ok: false, error: "Asset is larger than 50 MB" };
  }

  return { ok: true, ext, size: stats.size };
}

function getSafeFilename(sourcePath, importName = "") {
  const sourceExt = path.extname(sourcePath).toLowerCase();
  const rawName = typeof importName === "string" && importName.trim()
    ? importName.trim()
    : path.basename(sourcePath);
  const parsedExt = path.extname(rawName).toLowerCase();
  const filename = parsedExt ? rawName : `${rawName}${sourceExt}`;
  return filename
    .normalize("NFKC")
    .replace(/[\\/]/g, "_")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^_+|_+$/g, "") || `asset${sourceExt}`;
}

function getAssetCandidate(filename, counter) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return counter === 0 ? filename : `${base}-${counter}${ext}`;
}

function copyAssetToPackage({ sourcePath, packageDir, importName = "" }) {
  const validation = validateAsset(sourcePath);
  if (!validation.ok) {
    return validation;
  }

  if (typeof packageDir !== "string" || packageDir.trim() === "") {
    return { ok: false, error: "Package directory is required" };
  }

  const assetsDir = path.join(packageDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const safeFilename = getSafeFilename(sourcePath, importName);
  let counter = 0;

  while (counter < 1000) {
    const filename = getAssetCandidate(safeFilename, counter);
    const absolutePath = path.join(assetsDir, filename);

    if (importName && counter === 0 && fs.existsSync(absolutePath)) {
      return { ok: false, error: `Asset name already exists: ${filename}` };
    }

    try {
      fs.copyFileSync(sourcePath, absolutePath, fs.constants.COPYFILE_EXCL);
      return {
        ok: true,
        asset: `assets/${filename}`,
        ...(importName ? { displayName: filename } : {})
      };
    } catch (error) {
      if (error && error.code === "EEXIST") {
        counter += 1;
        continue;
      }

      throw error;
    }
  }

  return { ok: false, error: "Could not find an available asset filename" };
}

function deleteAssetFromPackage({ packageDir, assetPath }) {
  if (typeof packageDir !== "string" || packageDir.trim() === "") {
    return { ok: false, error: "Package directory is required" };
  }

  if (!isSafeRelativePath(assetPath) || !assetPath.startsWith("assets/")) {
    return { ok: false, error: "Asset path is unsafe" };
  }

  if (!SUPPORTED_ASSET_EXTENSIONS.includes(path.extname(assetPath).toLowerCase())) {
    return { ok: false, error: `Unsupported asset extension: ${path.extname(assetPath).toLowerCase() || "(none)"}` };
  }

  const packageRoot = path.resolve(packageDir);
  const absolutePath = path.resolve(packageRoot, assetPath);
  const relative = path.relative(packageRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { ok: false, error: "Asset path is unsafe" };
  }

  if (!fs.existsSync(absolutePath)) {
    return { ok: false, error: "Asset file does not exist" };
  }

  const stats = fs.lstatSync(absolutePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    return { ok: false, error: "Asset path is not a file" };
  }

  fs.unlinkSync(absolutePath);
  return { ok: true, asset: assetPath };
}

module.exports = {
  MAX_ASSET_BYTES,
  copyAssetToPackage,
  deleteAssetFromPackage,
  getAssetDurationMs,
  getGifDurationMs,
  validateAsset
};
