import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import petpackModule from "../../src/main/services/petpack";

const { exportPetpack, importPetpack } = petpackModule;
const IDLE_ID = "20000000-0000-4000-8000-000000000001";
const WAVE_ID = "20000000-0000-4000-8000-000000000002";
const CLICK_ID = "20000000-0000-4000-8000-000000000003";

function createManifest(packageId = "demo-pet") {
  return {
    schemaVersion: "2.0.0",
    packageId,
    name: "Demo Pet",
    version: "1.0.0",
    preview: "preview.png",
    animations: {
      default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.webm" },
      clips: [
        { id: WAVE_ID, name: "Wave", type: "oneshot", asset: "assets/wave.webm", durationMs: 900 }
      ]
    },
    triggerRules: [
      {
        id: "click-wave",
        name: "Click Wave",
        relation: "single",
        conditions: ["click"],
        actions: [{ type: "playAnimation", animation: WAVE_ID, durationMs: 900 }]
      }
    ]
  };
}

async function writeZip(targetPath, files) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(targetPath, buffer);
}

describe("petpack", () => {
  let tempDir;
  let userDataDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-petpack-"));
    userDataDir = path.join(tempDir, "user-data");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("imports a valid petpack into userData packages", async () => {
    const petpackPath = path.join(tempDir, "demo.petpack");
    await writeZip(petpackPath, {
      "manifest.json": JSON.stringify(createManifest("demo-pet")),
      "preview.png": "preview",
      "assets/idle.webm": "idle",
      "assets/wave.webm": "wave"
    });

    const result = await importPetpack(petpackPath, userDataDir);

    expect(result).toEqual({ ok: true, packageId: "demo-pet", fileCount: 4 });
    expect(JSON.parse(fs.readFileSync(path.join(userDataDir, "packages", "demo-pet", "manifest.json"), "utf8"))).toMatchObject({
      packageId: "demo-pet"
    });
    expect(fs.readFileSync(path.join(userDataDir, "packages", "demo-pet", "assets", "idle.webm"), "utf8")).toBe("idle");
  });

  it("rejects unsafe zip entries without partial writes", async () => {
    const petpackPath = path.join(tempDir, "unsafe.petpack");
    await writeZip(petpackPath, {
      "manifest.json": JSON.stringify(createManifest("unsafe-pet")),
      "preview.png": "preview",
      "assets/idle.webm": "idle",
      "assets/wave.webm": "wave",
      "../escape.txt": "bad"
    });

    const result = await importPetpack(petpackPath, userDataDir);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unsafe zip entry");
    expect(fs.existsSync(path.join(userDataDir, "packages", "unsafe-pet"))).toBe(false);
    expect(fs.existsSync(path.join(userDataDir, "escape.txt"))).toBe(false);
  });

  it("rejects petpacks missing manifest.json", async () => {
    const petpackPath = path.join(tempDir, "missing-manifest.petpack");
    await writeZip(petpackPath, {
      "assets/idle.webm": "idle"
    });

    const result = await importPetpack(petpackPath, userDataDir);

    expect(result).toEqual({ ok: false, error: "manifest.json is required" });
    expect(fs.existsSync(path.join(userDataDir, "packages"))).toBe(false);
  });

  it("rejects petpacks with too many zip entries", async () => {
    const petpackPath = path.join(tempDir, "too-many.petpack");
    const files = {
      "manifest.json": JSON.stringify(createManifest("too-many-pet")),
      "preview.png": "preview",
      "assets/idle.webm": "idle",
      "assets/wave.webm": "wave"
    };
    for (let index = 0; index < 4; index += 1) {
      files[`assets/extra-${index}.png`] = "extra";
    }
    await writeZip(petpackPath, files);

    const result = await importPetpack(petpackPath, userDataDir, { maxEntries: 6 });

    expect(result).toEqual({ ok: false, error: "Petpack contains too many entries" });
    expect(fs.existsSync(path.join(userDataDir, "packages", "too-many-pet"))).toBe(false);
  });

  it("rejects petpacks when a single entry exceeds the byte limit", async () => {
    const petpackPath = path.join(tempDir, "large-entry.petpack");
    await writeZip(petpackPath, {
      "manifest.json": JSON.stringify(createManifest("large-entry-pet")),
      "preview.png": "preview",
      "assets/idle.webm": "x".repeat(2048),
      "assets/wave.webm": "wave"
    });

    const result = await importPetpack(petpackPath, userDataDir, { maxEntryBytes: 1500 });

    expect(result).toEqual({ ok: false, error: "Petpack entry is too large: assets/idle.webm" });
    expect(fs.existsSync(path.join(userDataDir, "packages", "large-entry-pet"))).toBe(false);
  });

  it("rejects petpacks when total extracted bytes exceed the limit", async () => {
    const petpackPath = path.join(tempDir, "large-total.petpack");
    await writeZip(petpackPath, {
      "manifest.json": JSON.stringify(createManifest("large-total-pet")),
      "preview.png": "preview",
      "assets/idle.webm": "idle",
      "assets/wave.webm": "wave"
    });

    const result = await importPetpack(petpackPath, userDataDir, { maxTotalBytes: 12 });

    expect(result).toEqual({ ok: false, error: "Petpack extracted content is too large" });
    expect(fs.existsSync(path.join(userDataDir, "packages", "large-total-pet"))).toBe(false);
  });

  it("rejects explicit directory and symlink zip entries", async () => {
    const petpackPath = path.join(tempDir, "non-files.petpack");
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(createManifest("non-files-pet")));
    zip.file("preview.png", "preview");
    zip.file("assets/idle.webm", "idle");
    zip.file("assets/wave.webm", "wave");
    zip.folder("assets/empty-dir");
    zip.file("assets/link.webm", "assets/idle.webm", { unixPermissions: 0o120777 });
    fs.writeFileSync(petpackPath, await zip.generateAsync({ type: "nodebuffer", platform: "UNIX" }));

    const result = await importPetpack(petpackPath, userDataDir);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unsafe zip entry|Zip entry cannot be a symbolic link/);
    expect(fs.existsSync(path.join(userDataDir, "packages", "non-files-pet"))).toBe(false);
  });

  it("exports a package zip containing manifest and assets", async () => {
    const packageDir = path.join(userDataDir, "packages", "export-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(createManifest("export-pet")), "utf8");
    fs.writeFileSync(path.join(packageDir, "preview.png"), "preview", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.webm"), "idle", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.webm"), "wave", "utf8");
    const targetPath = path.join(tempDir, "export.petpack");

    const result = await exportPetpack("export-pet", userDataDir, targetPath);

    expect(result).toEqual({ ok: true, packageId: "export-pet", fileCount: 4, targetPath });
    const zip = await JSZip.loadAsync(fs.readFileSync(targetPath));
    expect(zip.file("manifest.json")).toBeTruthy();
    expect(zip.file("preview.png")).toBeTruthy();
    expect(zip.file("assets/idle.webm")).toBeTruthy();
    expect(JSON.parse(await zip.file("manifest.json").async("string")).packageId).toBe("export-pet");
  });

  it("exports a petpack manifest merged with saved panel config", async () => {
    const packageDir = path.join(userDataDir, "packages", "merged-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(createManifest("merged-pet")), "utf8");
    fs.writeFileSync(path.join(packageDir, "preview.png"), "preview", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.webm"), "idle", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.webm"), "wave", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "click.webm"), "click", "utf8");
    const targetPath = path.join(tempDir, "merged.petpack");

    const result = await exportPetpack("merged-pet", userDataDir, targetPath, {
      animations: {
        default: { id: IDLE_ID, name: "Idle", asset: "assets/idle.webm" },
        clips: [
          { id: CLICK_ID, name: "Click", asset: "assets/click.webm", type: "oneshot", durationMs: 700 }
        ]
      },
      triggerRules: [
        { id: "configured-click", name: "Configured Click", relation: "single", conditions: ["click"], actions: [{ type: "playAnimation", animation: CLICK_ID, durationMs: 700 }] }
      ]
    });

    expect(result.ok).toBe(true);
    const zip = await JSZip.loadAsync(fs.readFileSync(targetPath));
    const exportedManifest = JSON.parse(await zip.file("manifest.json").async("string"));
    expect(exportedManifest.animations.clips).toEqual([
      { id: CLICK_ID, name: "Click", asset: "assets/click.webm", type: "oneshot", durationMs: 700 }
    ]);
    expect(exportedManifest.triggerRules.find((rule) => rule.id === "configured-click")).toEqual({
      id: "configured-click",
      name: "Configured Click",
      relation: "single",
      conditions: ["click"],
      actions: [{ type: "playAnimation", animation: CLICK_ID, durationMs: 700 }]
    });
  });

  it("restores an existing package when replacement rename fails", async () => {
    const packageDir = path.join(userDataDir, "packages", "demo-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(createManifest("demo-pet")), "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.webm"), "old idle", "utf8");

    const petpackPath = path.join(tempDir, "demo.petpack");
    await writeZip(petpackPath, {
      "manifest.json": JSON.stringify(createManifest("demo-pet")),
      "preview.png": "preview",
      "assets/idle.webm": "new idle",
      "assets/wave.webm": "wave"
    });

    const originalRenameSync = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (to === packageDir && String(from).includes(".tmp-demo-pet-")) {
        throw new Error("simulated replacement failure");
      }
      return originalRenameSync(from, to);
    });

    const result = await importPetpack(petpackPath, userDataDir);

    expect(result).toEqual({ ok: false, error: "simulated replacement failure" });
    expect(fs.readFileSync(path.join(packageDir, "assets", "idle.webm"), "utf8")).toBe("old idle");
    expect(fs.readdirSync(path.dirname(packageDir)).filter((name) => name.includes(".tmp-demo-pet-"))).toEqual([]);
  });

  it("keeps an existing export when final rename fails", async () => {
    const packageDir = path.join(userDataDir, "packages", "export-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(createManifest("export-pet")), "utf8");
    fs.writeFileSync(path.join(packageDir, "preview.png"), "preview", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.webm"), "idle", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.webm"), "wave", "utf8");
    const targetPath = path.join(tempDir, "existing.petpack");
    fs.writeFileSync(targetPath, "previous export", "utf8");

    const originalRenameSync = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (to === targetPath && String(from).includes(".tmp-existing.petpack-")) {
        throw new Error("simulated export replacement failure");
      }
      return originalRenameSync(from, to);
    });

    const result = await exportPetpack("export-pet", userDataDir, targetPath);

    expect(result).toEqual({ ok: false, error: "simulated export replacement failure" });
    expect(fs.readFileSync(targetPath, "utf8")).toBe("previous export");
    expect(fs.readdirSync(tempDir).filter((name) => name.includes(".tmp-existing.petpack-"))).toEqual([]);
  });

  it("rejects export when manifest references missing package files", async () => {
    const packageDir = path.join(userDataDir, "packages", "broken-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(createManifest("broken-pet")), "utf8");
    fs.writeFileSync(path.join(packageDir, "preview.png"), "preview", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.webm"), "idle", "utf8");
    const targetPath = path.join(tempDir, "broken.petpack");

    const result = await exportPetpack("broken-pet", userDataDir, targetPath);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("asset not found: assets/wave.webm");
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it("rejects export when package contains unsupported extra files", async () => {
    const packageDir = path.join(userDataDir, "packages", "unsupported-export-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(createManifest("unsupported-export-pet")), "utf8");
    fs.writeFileSync(path.join(packageDir, "preview.png"), "preview", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.webm"), "idle", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.webm"), "wave", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "debug.exe"), "bad", "utf8");
    const targetPath = path.join(tempDir, "unsupported.petpack");

    const result = await exportPetpack("unsupported-export-pet", userDataDir, targetPath);

    expect(result).toEqual({
      ok: false,
      error: "Package file extension is not supported: assets/debug.exe"
    });
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it("rejects export when manifest packageId is unsafe", async () => {
    const packageDir = path.join(userDataDir, "packages", "safe-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(createManifest("../escape")), "utf8");
    fs.writeFileSync(path.join(packageDir, "preview.png"), "preview", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.webm"), "idle", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.webm"), "wave", "utf8");
    const targetPath = path.join(tempDir, "unsafe-id.petpack");

    const result = await exportPetpack("safe-pet", userDataDir, targetPath);

    expect(result).toEqual({ ok: false, error: "Manifest package ID is unsafe" });
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it("rejects export when manifest packageId differs from selected packageId", async () => {
    const packageDir = path.join(userDataDir, "packages", "safe-pet");
    fs.mkdirSync(path.join(packageDir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "manifest.json"), JSON.stringify(createManifest("other-pet")), "utf8");
    fs.writeFileSync(path.join(packageDir, "preview.png"), "preview", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "idle.webm"), "idle", "utf8");
    fs.writeFileSync(path.join(packageDir, "assets", "wave.webm"), "wave", "utf8");
    const targetPath = path.join(tempDir, "wrong-id.petpack");

    const result = await exportPetpack("safe-pet", userDataDir, targetPath);

    expect(result).toEqual({ ok: false, error: "Manifest package ID does not match selected package" });
    expect(fs.existsSync(targetPath)).toBe(false);
  });
});
