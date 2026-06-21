import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import petpackModule from "../../src/main/services/petpack";

const { exportPetpack, importPetpack } = petpackModule;

function createManifest(packageId = "demo-pet") {
  return {
    schemaVersion: "1.0.0",
    packageId,
    name: "Demo Pet",
    version: "1.0.0",
    preview: "preview.png",
    states: {
      idle: [{ id: "idle-default", asset: "assets/idle.webm", loop: true }]
    },
    actions: [
      { id: "wave", name: "Wave", type: "playAnimation", asset: "assets/wave.webm" }
    ],
    triggers: [
      {
        id: "click-wave",
        name: "Click Wave",
        relation: "single",
        conditions: ["click"],
        actions: ["wave"]
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
    expect(await zip.file("manifest.json").async("string")).toContain("\"packageId\":\"export-pet\"");
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
