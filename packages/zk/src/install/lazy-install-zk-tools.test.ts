import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
const originalArch = Object.getOwnPropertyDescriptor(process, "arch");

function stubPlatform(platform: string, arch: string) {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  Object.defineProperty(process, "arch", { value: arch, configurable: true });
}

function restorePlatform() {
  if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
  if (originalArch) Object.defineProperty(process, "arch", originalArch);
}

describe("ensureCircom", () => {
  let tempHome = "";

  beforeEach(() => {
    stubPlatform("linux", "x64");
  });

  afterEach(async () => {
    restorePlatform();
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

describe("ensureCircom without a pinned release asset", () => {
  afterEach(() => {
    restorePlatform();
    vi.resetAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadEnsureCircom() {
    vi.resetModules();
    const module = await import("./lazy-install-zk-tools.js");
    return module.ensureCircom;
  }

  it("should_use_circom_on_path_when_platform_has_no_release_asset", async () => {
    stubPlatform("darwin", "arm64");
    runCommandMock.mockResolvedValue({ all: "circom compiler 2.2.3\n" });
    const statuses: string[] = [];

    const ensureCircom = await loadEnsureCircom();
    const circom = await ensureCircom({ onStatus: (message) => statuses.push(message) });

    expect(circom).toBe("circom");
    expect(runCommandMock).toHaveBeenCalledWith("circom", ["--version"]);
    expect(downloadWithProgressMock).not.toHaveBeenCalled();
    expect(verifyFileChecksumMock).not.toHaveBeenCalled();
    expect(statuses.join("\n")).toContain("No pinned circom release for darwin-arm64");
    expect(statuses.join("\n")).toContain("circom 2.2.3");
  });

  it("should_prefer_caatinga_circom_env_over_path", async () => {
    stubPlatform("darwin", "arm64");
    vi.stubEnv("CAATINGA_CIRCOM", "/opt/circom/bin/circom");
    runCommandMock.mockResolvedValue({ all: "circom compiler 2.1.9\n" });

    const ensureCircom = await loadEnsureCircom();

    await expect(ensureCircom()).resolves.toBe("/opt/circom/bin/circom");
    expect(runCommandMock).toHaveBeenCalledWith("/opt/circom/bin/circom", ["--version"]);
  });

  it("should_fall_back_on_platforms_without_any_asset_name", async () => {
    stubPlatform("win32", "x64");
    runCommandMock.mockResolvedValue({ all: "circom compiler 2.1.9\n" });

    const ensureCircom = await loadEnsureCircom();

    await expect(ensureCircom()).resolves.toBe("circom");
  });

  it("should_throw_actionable_error_when_circom_is_not_found", async () => {
    stubPlatform("darwin", "arm64");
    runCommandMock.mockRejectedValue(new Error("spawn circom ENOENT"));

    const ensureCircom = await loadEnsureCircom();
    const error = await ensureCircom().catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "ZK_UNSUPPORTED_PLATFORM",
      hint: expect.stringContaining("CAATINGA_CIRCOM"),
    });
    expect(downloadWithProgressMock).not.toHaveBeenCalled();
  });

  it.each(["circom compiler 2.0.8", "circom compiler 1.0.0", "not circom at all"])(
    "should_reject_unsupported_circom_version_%s",
    async (output) => {
      stubPlatform("darwin", "arm64");
      runCommandMock.mockResolvedValue({ all: output });

      const ensureCircom = await loadEnsureCircom();

      await expect(ensureCircom()).rejects.toMatchObject({ code: "ZK_UNSUPPORTED_PLATFORM" });
    }
  );

  it("should_read_the_version_from_the_circom_compiler_line_only", async () => {
    stubPlatform("darwin", "arm64");
    runCommandMock.mockResolvedValue({ all: "wrapper 0.0.1\ncircom compiler 2.1.9\n" });

    const ensureCircom = await loadEnsureCircom();

    await expect(ensureCircom()).resolves.toBe("circom");
  });

  it("should_reject_a_version_number_that_is_not_on_the_circom_compiler_line", async () => {
    stubPlatform("darwin", "arm64");
    runCommandMock.mockResolvedValue({ all: "some other tool 2.9.9\n" });

    const ensureCircom = await loadEnsureCircom();

    await expect(ensureCircom()).rejects.toMatchObject({ code: "ZK_UNSUPPORTED_PLATFORM" });
  });

  it("should_not_consult_path_when_a_pinned_asset_exists", async () => {
    stubPlatform("linux", "x64");
    vi.stubEnv("CAATINGA_CIRCOM", "/opt/circom/bin/circom");
    downloadWithProgressMock.mockImplementation(async (_url, destination) => {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, "downloaded-circom", "utf8");
    });
    const tempHome = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-home-"));
    vi.stubEnv("HOME", tempHome);

    const ensureCircom = await loadEnsureCircom();
    const circom = await ensureCircom();

    expect(circom).toContain("circom-linux-amd64");
    expect(runCommandMock).not.toHaveBeenCalled();
    expect(verifyFileChecksumMock).toHaveBeenCalledOnce();
    await rm(tempHome, { recursive: true, force: true });
  });
});

/**
 * snarkjs is installed from the committed `snarkjs-package-lock.json`. To bump SNARKJS_VERSION,
 * regenerate it in an empty dir with
 * `npm install --package-lock-only --ignore-scripts --legacy-peer-deps --save-exact snarkjs@<version>`
 * (package.json: `{ "name": "caatinga-zk-snarkjs", "private": true, "version": "0.0.0" }`).
 */
describe("ensureSnarkjs", () => {
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

  async function loadEnsureSnarkjs() {
    vi.resetModules();
    const module = await import("./lazy-install-zk-tools.js");
    return module.ensureSnarkjs;
  }

  it("should_install_from_the_pinned_lockfile_without_running_install_scripts", async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-home-"));
    vi.stubEnv("HOME", tempHome);
    runCommandMock.mockResolvedValue({ all: "" });

    const ensureSnarkjs = await loadEnsureSnarkjs();
    const cliPath = await ensureSnarkjs();

    const installDir = path.join(tempHome, ".caatinga", "zk-tools", "snarkjs-0.7.5-locked");
    expect(cliPath).toBe(path.join(installDir, "node_modules", ".bin", "snarkjs"));
    expect(runCommandMock).toHaveBeenCalledOnce();
    const [command, args, options] = runCommandMock.mock.calls[0] ?? [];
    expect(command).toBe("npm");
    expect(args).toContain("ci");
    expect(args).toContain("--ignore-scripts");
    expect(args).not.toContain("install");
    expect(options).toMatchObject({ cwd: installDir });

    const manifest = JSON.parse(await readFile(path.join(installDir, "package.json"), "utf8"));
    const lock = JSON.parse(await readFile(path.join(installDir, "package-lock.json"), "utf8"));
    expect(manifest.dependencies).toEqual({ snarkjs: "0.7.5" });
    expect(lock.packages[""].dependencies).toEqual(manifest.dependencies);
    expect(lock.packages["node_modules/snarkjs"].version).toBe("0.7.5");
  });

  it("should_pin_every_locked_package_to_the_npm_registry_with_integrity", async () => {
    const { default: lock } = await import("./snarkjs-package-lock.json", {
      with: { type: "json" },
    });
    const entries = Object.entries(
      lock.packages as Record<
        string,
        { resolved?: string; integrity?: string; hasInstallScript?: boolean }
      >
    ).filter(([key]) => key !== "");

    expect(entries.length).toBeGreaterThan(0);
    for (const [key, entry] of entries) {
      expect(entry.resolved, key).toMatch(/^https:\/\/registry\.npmjs\.org\//);
      expect(entry.integrity, key).toMatch(/^sha512-/);
      expect(entry.hasInstallScript, key).toBeUndefined();
    }
  });

  it("should_reuse_an_existing_locked_install_without_running_npm", async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-home-"));
    vi.stubEnv("HOME", tempHome);
    const binDir = path.join(
      tempHome,
      ".caatinga",
      "zk-tools",
      "snarkjs-0.7.5-locked",
      "node_modules",
      ".bin"
    );
    await mkdir(binDir, { recursive: true });
    await writeFile(path.join(binDir, "snarkjs"), "", "utf8");

    const ensureSnarkjs = await loadEnsureSnarkjs();
    await ensureSnarkjs();

    expect(runCommandMock).not.toHaveBeenCalled();
  });
});
