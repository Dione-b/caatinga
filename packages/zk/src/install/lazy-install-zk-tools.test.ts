import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const downloadWithProgressMock = vi.hoisted(() => vi.fn());
const runCommandMock = vi.hoisted(() => vi.fn());
const verifyFileChecksumMock = vi.hoisted(() => vi.fn());

vi.mock("./download-with-progress.js", () => ({
  downloadWithProgress: downloadWithProgressMock,
}));

vi.mock("@caatinga/core", () => ({
  runCommand: runCommandMock,
}));

vi.mock("./verify-checksum.js", () => ({
  verifyFileChecksum: verifyFileChecksumMock,
}));

describe("ensureCircom", () => {
  let tempHome = "";

  afterEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    if (tempHome) {
      await rm(tempHome, { recursive: true, force: true });
      tempHome = "";
    }
  });

  async function loadEnsureCircom() {
    vi.resetModules();
    const module = await import("./lazy-install-zk-tools.js");
    return module.ensureCircom;
  }

  it("should_report_status_and_download_when_cache_miss", async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-home-"));
    vi.stubEnv("HOME", tempHome);

    downloadWithProgressMock.mockImplementation(async (_url, destination) => {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, "downloaded-circom", "utf8");
    });

    const ensureCircom = await loadEnsureCircom();
    const statuses: string[] = [];

    const binaryPath = await ensureCircom({
      onStatus(message) {
        statuses.push(message);
      },
    });

    expect(downloadWithProgressMock).toHaveBeenCalledOnce();
    expect(verifyFileChecksumMock).toHaveBeenCalledOnce();
    expect(statuses.some((message) => message.includes("Downloading circom"))).toBe(true);
    expect(statuses.some((message) => message.includes("circom installed"))).toBe(true);
    expect(binaryPath).toContain("circom-linux-amd64");
  });

  it("should_reject_and_delete_binary_when_checksum_does_not_match", async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-home-"));
    vi.stubEnv("HOME", tempHome);

    downloadWithProgressMock.mockImplementation(async (_url, destination) => {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, "tampered-circom", "utf8");
    });
    verifyFileChecksumMock.mockImplementation(async (filePath: string) => {
      await rm(filePath, { force: true });
      throw new Error("Checksum mismatch");
    });

    const ensureCircom = await loadEnsureCircom();
    const installedPath = path.join(
      tempHome,
      ".caatinga",
      "zk-tools",
      "circom",
      "2.1.9",
      "circom-linux-amd64"
    );

    await expect(ensureCircom()).rejects.toThrow("Checksum mismatch");
    await expect(access(installedPath)).rejects.toThrow();
  });

  it("should_redownload_when_cached_binary_fails_checksum", async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-home-"));
    vi.stubEnv("HOME", tempHome);

    const installDir = path.join(tempHome, ".caatinga", "zk-tools", "circom", "2.1.9");
    const binaryPath = path.join(installDir, "circom-linux-amd64");
    await mkdir(installDir, { recursive: true });
    await writeFile(binaryPath, "tampered-cache-entry", "utf8");

    verifyFileChecksumMock
      .mockImplementationOnce(async (filePath: string) => {
        await rm(filePath, { force: true });
        throw new Error("Checksum mismatch");
      })
      .mockImplementationOnce(async () => undefined);

    downloadWithProgressMock.mockImplementation(async (_url, destination) => {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, "fresh-circom", "utf8");
    });

    const ensureCircom = await loadEnsureCircom();
    const resolvedPath = await ensureCircom();

    expect(downloadWithProgressMock).toHaveBeenCalledOnce();
    expect(verifyFileChecksumMock).toHaveBeenCalledTimes(2);
    expect(resolvedPath).toBe(binaryPath);
  });

  it("should_reuse_cached_binary_without_downloading", async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-home-"));
    vi.stubEnv("HOME", tempHome);

    const installDir = path.join(tempHome, ".caatinga", "zk-tools", "circom", "2.1.9");
    const binaryPath = path.join(installDir, "circom-linux-amd64");
    await mkdir(installDir, { recursive: true });
    await writeFile(binaryPath, "cached-circom", "utf8");

    const ensureCircom = await loadEnsureCircom();
    const statuses: string[] = [];

    const resolvedPath = await ensureCircom({
      onStatus(message) {
        statuses.push(message);
      },
    });

    expect(downloadWithProgressMock).not.toHaveBeenCalled();
    expect(verifyFileChecksumMock).toHaveBeenCalledOnce();
    expect(resolvedPath).toBe(binaryPath);
    expect(statuses).toEqual(["Using cached circom v2.1.9"]);
    await expect(access(binaryPath)).resolves.toBeUndefined();
  });
});
