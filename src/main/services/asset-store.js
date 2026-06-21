const fs = require("node:fs");
const path = require("node:path");
const { SUPPORTED_ASSET_EXTENSIONS } = require("../../shared/schema");

const MAX_ASSET_BYTES = 50 * 1024 * 1024;

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

function getSafeFilename(sourcePath) {
  const originalName = path.basename(sourcePath);
  return originalName.replace(/[^\w.-]/g, "_") || `asset${path.extname(sourcePath).toLowerCase()}`;
}

function getAssetCandidate(filename, counter) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return counter === 0 ? filename : `${base}-${counter}${ext}`;
}

function copyAssetToPackage({ sourcePath, packageDir }) {
  const validation = validateAsset(sourcePath);
  if (!validation.ok) {
    return validation;
  }

  if (typeof packageDir !== "string" || packageDir.trim() === "") {
    return { ok: false, error: "Package directory is required" };
  }

  const assetsDir = path.join(packageDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const safeFilename = getSafeFilename(sourcePath);
  let counter = 0;

  while (counter < 1000) {
    const filename = getAssetCandidate(safeFilename, counter);
    const absolutePath = path.join(assetsDir, filename);

    try {
      fs.copyFileSync(sourcePath, absolutePath, fs.constants.COPYFILE_EXCL);
      return { ok: true, asset: `assets/${filename}` };
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

module.exports = {
  MAX_ASSET_BYTES,
  copyAssetToPackage,
  validateAsset
};
