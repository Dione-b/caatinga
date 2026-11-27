import { runCommand } from "@caatinga/core";
import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ZkError } from "../errors/ZkError.js";
import { devContributionInput } from "./dev-contribution.js";
import { downloadWithProgress } from "./download-with-progress.js";
import type { ZkInstallProgress } from "./install-progress.js";
import snarkjsPackageLock from "./snarkjs-package-lock.json" with { type: "json" };
import { verifyFileChecksum } from "./verify-checksum.js";

const SNARKJS_VERSION = "0.7.5";
/**
 * Install dir name for snarkjs. The `-locked` suffix keeps installs made before the
 * lockfile pin (plain `npm install`, unpinned transitive deps) from being reused.
 */
const SNARKJS_INSTALL_DIR = `snarkjs-${SNARKJS_VERSION}-locked`;
const CIRCOM_VERSION = "2.1.9";

/**
 * SHA-256 of each circom v2.1.9 release asset, pinned so a compromised release
 * asset or on-path tamperer can't silently swap the binary we execute locally.
 * Recomputed directly from https://github.com/iden3/circom/releases/tag/v2.1.9.
 */
const CIRCOM_SHA256: Record<string, string> = {
  "circom-linux-amd64": "e5575829252d763b7818049df9de2ef9304df834697de77fa63ce7babc23c967",
  "circom-macos-amd64": "5c7dedaec105844dd90dc42c1ba9d7f67c265c5692fb3467465285fc09177e9f",
};

function zkCacheDir(): string {
  return path.join(process.env.HOME ?? os.homedir(), ".caatinga", "zk-tools");
}

function circomAssetName(): string | undefined {
  const arch = process.arch === "x64" ? "amd64" : process.arch;
  if (process.platform === "linux") {
    return `circom-linux-${arch}`;
  }
  if (process.platform === "darwin") {
    return `circom-macos-${arch}`;
  }
  return undefined;
}

/** Lowest circom release the generated circuits are validated against. */
const MIN_CIRCOM_VERSION = [2, 1, 9] as const;

function isSupportedCircomVersion(version: number[]): boolean {
  const [major = 0, minor = 0, patch = 0] = version;
  if (major !== MIN_CIRCOM_VERSION[0]) {
    return false;
  }
  return minor !== MIN_CIRCOM_VERSION[1]
    ? minor > MIN_CIRCOM_VERSION[1]
    : patch >= MIN_CIRCOM_VERSION[2];
}

/**
 * iden3/circom publishes no release asset for macOS arm64 or Linux arm64, and none is pinned here
 * for Windows, so there is nothing Caatinga could checksum and download. Instead use a circom the
 * user already installed: `CAATINGA_CIRCOM` (path or command) if set, else `circom` on PATH. The binary
 * is only run after `--version` reports a supported release; no download or checksum is involved.
 */
async function resolveInstalledCircom(
  platformLabel: string,
  progress?: ZkInstallProgress
): Promise<string> {
  const command = process.env.CAATINGA_CIRCOM?.trim() || "circom";
  const hint =
    `Install circom ${MIN_CIRCOM_VERSION.join(".")} or newer 2.x ` +
    "(cargo install --locked --git https://github.com/iden3/circom) so that `circom --version` " +
    "works on PATH, or set CAATINGA_CIRCOM to the circom binary.";
  let output: string;
  try {
    output = (await runCommand(command, ["--version"])).all;
  } catch (error) {
    throw new ZkError(
      `No circom release is pinned for ${platformLabel} and \`${command}\` could not be run`,
      "ZK_UNSUPPORTED_PLATFORM",
      hint,
      { cause: error }
    );
  }
  const found = /(\d+)\.(\d+)\.(\d+)/.exec(output);
  const version = found ? found.slice(1).map(Number) : [];
  if (!found || !isSupportedCircomVersion(version)) {
    throw new ZkError(
      `\`${command}\` reports an unsupported circom version: ${output.trim() || "no output"}`,
      "ZK_UNSUPPORTED_PLATFORM",
      hint
    );
  }
  progress?.onStatus?.(
    `No pinned circom release for ${platformLabel}; using circom ${found[0]} from ${command} (not checksum-verified by Caatinga)`
  );
  return command;
}

export async function ensureCircom(progress?: ZkInstallProgress): Promise<string> {
  const asset = circomAssetName();
  const expectedSha256 = asset ? CIRCOM_SHA256[asset] : undefined;
  if (!asset || !expectedSha256) {
    return resolveInstalledCircom(`${process.platform}-${process.arch}`, progress);
  }

  const installDir = path.join(zkCacheDir(), "circom", CIRCOM_VERSION);
  const binaryPath = path.join(installDir, asset);
  const releaseUrl = `https://github.com/iden3/circom/releases/tag/v${CIRCOM_VERSION}`;
  const url = `${releaseUrl}`.replace("/tag/", "/download/") + `/${asset}`;
  const context = { version: CIRCOM_VERSION, downloadUrl: url, releaseUrl };

  try {
    await access(binaryPath);
    await verifyFileChecksum(
      binaryPath,
      expectedSha256,
      `cached circom v${CIRCOM_VERSION} binary`,
      context
    );
    progress?.onStatus?.(`Using cached circom v${CIRCOM_VERSION}`);
    return binaryPath;
  } catch {
    // Missing or tampered cache entry (verifyFileChecksum deletes it on mismatch) — redownload.
  }

  await mkdir(installDir, { recursive: true });

  progress?.onStatus?.(`Downloading circom v${CIRCOM_VERSION} (${asset})...`);
  await downloadWithProgress(url, binaryPath, progress);
  await verifyFileChecksum(
    binaryPath,
    expectedSha256,
    `circom v${CIRCOM_VERSION} (${asset})`,
    context
  );
  await chmod(binaryPath, 0o755);
  progress?.onStatus?.(`circom installed → ${binaryPath}`);

  return binaryPath;
}

/**
 * Installs snarkjs from a committed lockfile (`snarkjs-package-lock.json`) with
 * `npm ci --ignore-scripts`: every transitive package is pinned to an exact version and
 * sha512 integrity, and no dependency install script runs on the user's machine. A
 * republished or hijacked transitive dependency fails the install instead of executing.
 * Regenerate the lockfile when bumping SNARKJS_VERSION (see the comment in the test file).
 */
export async function ensureSnarkjs(progress?: ZkInstallProgress): Promise<string> {
  const installDir = path.join(zkCacheDir(), SNARKJS_INSTALL_DIR);
  const cliPath = path.join(installDir, "node_modules", ".bin", "snarkjs");

  try {
    await access(cliPath);
    progress?.onStatus?.(`Using cached snarkjs v${SNARKJS_VERSION}`);
    return cliPath;
  } catch {
    progress?.onStatus?.(
      `Installing snarkjs v${SNARKJS_VERSION} into ${installDir} (first run only)...`
    );
    await mkdir(installDir, { recursive: true });
    await writeFile(
      path.join(installDir, "package.json"),
      JSON.stringify(
        {
          name: "caatinga-zk-snarkjs",
          private: true,
          version: "0.0.0",
          dependencies: { snarkjs: SNARKJS_VERSION },
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(installDir, "package-lock.json"),
      `${JSON.stringify(snarkjsPackageLock, null, 2)}\n`,
      "utf8"
    );
    await runCommand(
      "npm",
      ["ci", "--ignore-scripts", "--legacy-peer-deps", "--no-audit", "--no-fund"],
      {
        cwd: installDir,
      }
    );
    progress?.onStatus?.(`snarkjs installed → ${cliPath}`);
    return cliPath;
  }
}

export async function ensurePtau(size: number, progress?: ZkInstallProgress): Promise<string> {
  const ptauDir = path.join(zkCacheDir(), "ptau", "bls12-381");
  const finalPath = path.join(ptauDir, `pot${size}_final.ptau`);
  try {
    await access(finalPath);
    progress?.onStatus?.(`Using cached powers-of-tau (bls12-381, size ${size})`);
    return finalPath;
  } catch {
    await mkdir(ptauDir, { recursive: true });
  }

  progress?.onStatus?.(`Generating dev powers-of-tau (bls12-381, size ${size})...`);
  const snarkjs = await ensureSnarkjs(progress);
  const pot0 = path.join(ptauDir, `pot${size}_0000.ptau`);
  const pot1 = path.join(ptauDir, `pot${size}_0001.ptau`);

  await runCommand(snarkjs, ["powersoftau", "new", "bls12-381", String(size), pot0, "-v"]);
  await runCommand(snarkjs, ["powersoftau", "contribute", pot0, pot1, "-v"], {
    input: devContributionInput(),
  });
  await runCommand(snarkjs, ["powersoftau", "prepare", "phase2", pot1, finalPath, "-v"]);
  progress?.onStatus?.(`powers-of-tau ready → ${finalPath}`);

  return finalPath;
}
