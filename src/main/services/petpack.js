const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");
const { validateManifest } = require("../../shared/manifest-validator");
const { isSafeRelativePath } = require("../../shared/path-safety");

function errorResult(error) {
  return { ok: false, error };
}

function isSafePackageId(packageId) {
  return isSafeRelativePath(packageId) && !packageId.includes("/");
}

function assertSafePackagePath(userDataDir, packageId) {
  if (typeof userDataDir !== "string" || userDataDir.trim() === "") {
    return { ok: false, error: "User data directory is required" };
  }

  if (typeof packageId !== "string" || packageId.trim() === "" || !isSafePackageId(packageId)) {
    return { ok: false, error: "Package ID is unsafe" };
  }

  const packagesDir = path.resolve(userDataDir, "packages");
  const packageDir = path.resolve(packagesDir, packageId);
  const relative = path.relative(packagesDir, packageDir);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return { ok: false, error: "Package path is unsafe" };
  }

  return { ok: true, packagesDir, packageDir };
}

function uniquePath(parentDir, prefix) {
  return path.join(parentDir, `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function getEntryOriginalName(entry) {
  return entry.unsafeOriginalName || entry.name;
}

function validateZipEntries(zip) {
  const files = [];

  for (const entry of Object.values(zip.files)) {
    const originalName = getEntryOriginalName(entry);
    const originalPath = entry.dir && originalName.endsWith("/") ? originalName.slice(0, -1) : originalName;
    const entryPath = entry.dir && entry.name.endsWith("/") ? entry.name.slice(0, -1) : entry.name;
    if (!isSafeRelativePath(originalPath) || !isSafeRelativePath(entryPath) || originalPath !== entryPath) {
      return { ok: false, error: `Unsafe zip entry: ${originalName}` };
    }

    if (!entry.dir) {
      files.push(entry);
    }
  }

  return { ok: true, files };
}

async function readManifestFromZip(zip) {
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) {
    return errorResult("manifest.json is required");
  }

  try {
    return { ok: true, manifest: JSON.parse(await manifestEntry.async("string")) };
  } catch (_error) {
    return errorResult("manifest.json is not valid JSON");
  }
}

async function importPetpack(filePath, userDataDir) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return errorResult("Petpack path is required");
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  } catch (_error) {
    return errorResult("Petpack could not be read");
  }

  const entryValidation = validateZipEntries(zip);
  if (!entryValidation.ok) return entryValidation;

  const manifestResult = await readManifestFromZip(zip);
  if (!manifestResult.ok) return manifestResult;

  const fileNames = new Set(entryValidation.files.map((entry) => entry.name));
  const manifestValidation = validateManifest(manifestResult.manifest, fileNames);
  if (!manifestValidation.ok) {
    return errorResult(`Manifest is invalid: ${manifestValidation.errors.join("; ")}`);
  }

  const packageId = manifestResult.manifest.packageId;
  const packagePath = assertSafePackagePath(userDataDir, packageId);
  if (!packagePath.ok) return packagePath;

  const tempDir = uniquePath(packagePath.packagesDir, `.tmp-${packageId}`);
  let backupDir = "";

  try {
    fs.mkdirSync(tempDir, { recursive: true });

    for (const entry of entryValidation.files) {
      const targetPath = path.resolve(tempDir, entry.name);
      const relative = path.relative(tempDir, targetPath);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Unsafe zip entry: ${entry.name}`);
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, await entry.async("nodebuffer"));
    }

    if (fs.existsSync(packagePath.packageDir)) {
      backupDir = uniquePath(packagePath.packagesDir, `.backup-${packageId}`);
      fs.renameSync(packagePath.packageDir, backupDir);
    }

    fs.renameSync(tempDir, packagePath.packageDir);
    if (backupDir) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    return { ok: true, packageId, fileCount: entryValidation.files.length };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (backupDir && fs.existsSync(backupDir) && !fs.existsSync(packagePath.packageDir)) {
      fs.renameSync(backupDir, packagePath.packageDir);
    }
    return errorResult(error.message || "Petpack import failed");
  }
}

function collectPackageFiles(packageDir, currentDir = packageDir, files = []) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(packageDir, absolutePath).split(path.sep).join("/");

    if (!isSafeRelativePath(relativePath)) {
      return { ok: false, error: `Unsafe package file: ${relativePath}` };
    }

    if (entry.isSymbolicLink()) {
      return { ok: false, error: `Package file cannot be a symbolic link: ${relativePath}` };
    }

    if (entry.isDirectory()) {
      const result = collectPackageFiles(packageDir, absolutePath, files);
      if (!result.ok) return result;
      continue;
    }

    if (!entry.isFile()) {
      return { ok: false, error: `Package entry is not a file: ${relativePath}` };
    }

    files.push({ absolutePath, relativePath });
  }

  return { ok: true, files };
}

async function exportPetpack(packageId, userDataDir, targetPath) {
  const packagePath = assertSafePackagePath(userDataDir, packageId);
  if (!packagePath.ok) return packagePath;

  if (typeof targetPath !== "string" || targetPath.trim() === "") {
    return errorResult("Export path is required");
  }

  if (!fs.existsSync(packagePath.packageDir)) {
    return errorResult("Package does not exist");
  }

  const collected = collectPackageFiles(packagePath.packageDir);
  if (!collected.ok) return collected;

  if (!collected.files.some((file) => file.relativePath === "manifest.json")) {
    return errorResult("manifest.json is required");
  }

  const availableFiles = new Set(collected.files.map((file) => file.relativePath));
  const manifestFile = collected.files.find((file) => file.relativePath === "manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile.absolutePath, "utf8"));
  } catch (_error) {
    return errorResult("manifest.json is not valid JSON");
  }

  if (!isSafePackageId(manifest.packageId)) {
    return errorResult("Manifest package ID is unsafe");
  }

  if (manifest.packageId !== packageId) {
    return errorResult("Manifest package ID does not match selected package");
  }

  const manifestValidation = validateManifest(manifest, availableFiles);
  if (!manifestValidation.ok) {
    return errorResult(`Manifest is invalid: ${manifestValidation.errors.join("; ")}`);
  }

  const zip = new JSZip();
  for (const file of collected.files) {
    zip.file(file.relativePath, fs.readFileSync(file.absolutePath));
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const targetDir = path.dirname(targetPath);
  const tempTargetPath = uniquePath(targetDir, `.tmp-${path.basename(targetPath)}`);

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(tempTargetPath, buffer);
    fs.renameSync(tempTargetPath, targetPath);
    return { ok: true, packageId, fileCount: collected.files.length, targetPath };
  } catch (error) {
    fs.rmSync(tempTargetPath, { force: true });
    return errorResult(error.message || "Petpack export failed");
  }
}

module.exports = {
  exportPetpack,
  importPetpack,
  isSafePackageId,
  readManifestFromZip,
  validateZipEntries
};
