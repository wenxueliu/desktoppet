import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import assetStoreModule from "../../src/main/services/asset-store";

const { copyAssetToPackage, deleteAssetFromPackage, validateAsset } = assetStoreModule;

describe("asset-store", () => {
  let tempDir;
  let packageDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-assets-"));
    packageDir = path.join(tempDir, "packages", "demo");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("validates a supported readable file", () => {
    const sourcePath = path.join(tempDir, "idle.PNG");
    fs.writeFileSync(sourcePath, "png data", "utf8");

    expect(validateAsset(sourcePath)).toEqual({
      ok: true,
      ext: ".png",
      size: 8
    });
  });

  it("rejects unsupported extensions", () => {
    const sourcePath = path.join(tempDir, "notes.txt");
    fs.writeFileSync(sourcePath, "not an asset", "utf8");

    expect(validateAsset(sourcePath)).toEqual({
      ok: false,
      error: "Unsupported asset extension: .txt"
    });
  });

  it("rejects symbolic links even when the link has a supported extension", () => {
    const targetPath = path.join(tempDir, "notes.txt");
    const symlinkPath = path.join(tempDir, "looks-like-asset.svg");
    fs.writeFileSync(targetPath, "not an asset", "utf8");
    fs.symlinkSync(targetPath, symlinkPath);

    expect(validateAsset(symlinkPath)).toEqual({
      ok: false,
      error: "Asset path cannot be a symbolic link"
    });
  });

  it("rejects files over 50 MB", () => {
    const sourcePath = path.join(tempDir, "large.webm");
    fs.writeFileSync(sourcePath, Buffer.alloc((50 * 1024 * 1024) + 1));

    expect(validateAsset(sourcePath)).toEqual({
      ok: false,
      error: "Asset is larger than 50 MB"
    });
  });

  it("copies assets into the package assets directory with collision-safe names", () => {
    const firstSource = path.join(tempDir, "idle.svg");
    const secondSource = path.join(tempDir, "nested", "idle.svg");
    fs.mkdirSync(path.dirname(secondSource), { recursive: true });
    fs.writeFileSync(firstSource, "<svg>first</svg>", "utf8");
    fs.writeFileSync(secondSource, "<svg>second</svg>", "utf8");

    const firstResult = copyAssetToPackage({ sourcePath: firstSource, packageDir });
    const secondResult = copyAssetToPackage({ sourcePath: secondSource, packageDir });

    expect(firstResult).toEqual({ ok: true, asset: "assets/idle.svg" });
    expect(secondResult).toEqual({ ok: true, asset: "assets/idle-1.svg" });
    expect(fs.readFileSync(path.join(packageDir, "assets", "idle.svg"), "utf8")).toBe("<svg>first</svg>");
    expect(fs.readFileSync(path.join(packageDir, "assets", "idle-1.svg"), "utf8")).toBe("<svg>second</svg>");
  });

  it("deletes safe package assets and rejects unsafe paths", () => {
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "assets", "idle.svg"), "<svg></svg>", "utf8");

    expect(deleteAssetFromPackage({ packageDir, assetPath: "../escape.svg" })).toEqual({
      ok: false,
      error: "Asset path is unsafe"
    });
    expect(deleteAssetFromPackage({ packageDir, assetPath: "assets/idle.svg" })).toEqual({
      ok: true,
      asset: "assets/idle.svg"
    });
    expect(fs.existsSync(path.join(packageDir, "assets", "idle.svg"))).toBe(false);
  });
});
