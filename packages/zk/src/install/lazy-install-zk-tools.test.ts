import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const downloadWithProgressMock = vi.hoisted(() => vi.fn());
const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("./download-with-progress.js", () => ({
  downloadWithProgress: downloadWithProgressMock,
}));

vi.mock("@caatinga/core", () => ({
  runCommand: runCommandMock,
}));

describe("ensureCircom", () => {
  let tempHome = "";

  afterEach(async () => {
    vi.clearAllMocks();
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
    expect(statuses.some((message) => message.includes("Downloading circom"))).toBe(true);
    expect(statuses.some((message) => message.includes("circom installed"))).toBe(true);
    expect(binaryPath).toContain("circom-linux-amd64");
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
    expect(resolvedPath).toBe(binaryPath);
    expect(statuses).toEqual(["Using cached circom v2.1.9"]);
    await expect(access(binaryPath)).resolves.toBeUndefined();
  });
});
