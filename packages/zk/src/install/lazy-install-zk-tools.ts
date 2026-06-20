import { runCommand } from "@caatinga/core";
import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { ZkError } from "../errors/ZkError.js";

const ZK_CACHE_DIR = path.join(os.homedir(), ".caatinga", "zk-tools");
const SNARKJS_VERSION = "0.7.5";
const CIRCOM_VERSION = "2.1.9";

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

export async function ensureCircom(): Promise<string> {
  const cached = path.join(ZK_CACHE_DIR, "circom", CIRCOM_VERSION, "circom");
  try {
    await access(cached);
    return cached;
  } catch {
    // Fall through to download.
  }

  const asset = circomAssetName();
  const url = `https://github.com/iden3/circom/releases/download/v${CIRCOM_VERSION}/${asset}`;
  const installDir = path.join(ZK_CACHE_DIR, "circom", CIRCOM_VERSION);
  await mkdir(installDir, { recursive: true });

  const archivePath = path.join(installDir, asset);
  await runCommand("curl", ["-fsSL", url, "-o", archivePath]);
  await chmod(archivePath, 0o755);

  return archivePath;
}

export async function ensureSnarkjs(): Promise<string> {
  const installDir = path.join(ZK_CACHE_DIR, `snarkjs-${SNARKJS_VERSION}`);
  const cliPath = path.join(installDir, "node_modules", ".bin", "snarkjs");

  try {
    await access(cliPath);
    return cliPath;
  } catch {
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
    return cliPath;
  }
}

export async function ensurePtau(size: number): Promise<string> {
  const ptauDir = path.join(ZK_CACHE_DIR, "ptau", "bls12-381");
  const finalPath = path.join(ptauDir, `pot${size}_final.ptau`);
  try {
    await access(finalPath);
    return finalPath;
  } catch {
    await mkdir(ptauDir, { recursive: true });
  }

  const snarkjs = await ensureSnarkjs();
  const pot0 = path.join(ptauDir, `pot${size}_0000.ptau`);
  const pot1 = path.join(ptauDir, `pot${size}_0001.ptau`);
  const entropy = createHash("sha256").update(randomBytes(32)).digest("hex");

  await runCommand(snarkjs, ["powersoftau", "new", "bls12-381", String(size), pot0, "-v"]);
  await runCommand(snarkjs, ["powersoftau", "contribute", pot0, pot1, "-v"], {
    input: `caatinga-dev\n${entropy}\n`,
  });
  await runCommand(snarkjs, ["powersoftau", "prepare", "phase2", pot1, finalPath, "-v"]);

  return finalPath;
}
