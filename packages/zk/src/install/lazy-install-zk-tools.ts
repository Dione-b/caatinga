import { runCommand } from "@caatinga/core";
import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { ZkError } from "../errors/ZkError.js";
import { downloadWithProgress } from "./download-with-progress.js";
import type { ZkInstallProgress } from "./install-progress.js";
import { verifyFileChecksum } from "./verify-checksum.js";

const SNARKJS_VERSION = "0.7.5";
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

function circomAssetName(): string {
  const platform = process.platform;
  const arch = process.arch === "x64" ? "amd64" : process.arch;
  if (platform === "linux") {
    return `circom-linux-${arch}`;
  }
  if (platform === "darwin") {
    return `circom-macos-${arch}`;
  }
  throw new ZkError(
    `Unsupported platform for automatic circom install: ${platform}`,
    "ZK_UNSUPPORTED_PLATFORM",
    "Install circom 2.x manually and ensure it is on PATH."
  );
}

export async function ensureCircom(progress?: ZkInstallProgress): Promise<string> {
  const asset = circomAssetName();
  const expectedSha256 = CIRCOM_SHA256[asset];
  if (!expectedSha256) {
    throw new ZkError(
      `No pinned checksum for circom asset: ${asset}`,
      "ZK_UNSUPPORTED_PLATFORM",
      "Install circom 2.x manually and ensure it is on PATH."
    );
  }

  const installDir = path.join(zkCacheDir(), "circom", CIRCOM_VERSION);
  const binaryPath = path.join(installDir, asset);

  try {
    await access(binaryPath);
    await verifyFileChecksum(binaryPath, expectedSha256, `cached circom v${CIRCOM_VERSION}`);
    progress?.onStatus?.(`Using cached circom v${CIRCOM_VERSION}`);
    return binaryPath;
  } catch {
    // Missing or tampered cache entry (verifyFileChecksum deletes it on mismatch) — redownload.
  }

  const url = `https://github.com/iden3/circom/releases/download/v${CIRCOM_VERSION}/${asset}`;
  await mkdir(installDir, { recursive: true });

  progress?.onStatus?.(`Downloading circom v${CIRCOM_VERSION} (${asset})...`);
  await downloadWithProgress(url, binaryPath, progress);
  await verifyFileChecksum(binaryPath, expectedSha256, `circom v${CIRCOM_VERSION} (${asset})`);
  await chmod(binaryPath, 0o755);
  progress?.onStatus?.(`circom installed → ${binaryPath}`);

  return binaryPath;
}

export async function ensureSnarkjs(progress?: ZkInstallProgress): Promise<string> {
  const installDir = path.join(zkCacheDir(), `snarkjs-${SNARKJS_VERSION}`);
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
      JSON.stringify({ name: "caatinga-zk-snarkjs", private: true, version: "0.0.0" }, null, 2),
      "utf8"
    );
    await runCommand(
      "npm",
      ["install", "--no-save", "--legacy-peer-deps", `snarkjs@${SNARKJS_VERSION}`],
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
  const entropy = createHash("sha256").update(randomBytes(32)).digest("hex");

  await runCommand(snarkjs, ["powersoftau", "new", "bls12-381", String(size), pot0, "-v"]);
  await runCommand(snarkjs, ["powersoftau", "contribute", pot0, pot1, "-v"], {
    input: `caatinga-dev\n${entropy}\n`,
  });
  await runCommand(snarkjs, ["powersoftau", "prepare", "phase2", pot1, finalPath, "-v"]);
  progress?.onStatus?.(`powers-of-tau ready → ${finalPath}`);

  return finalPath;
}
