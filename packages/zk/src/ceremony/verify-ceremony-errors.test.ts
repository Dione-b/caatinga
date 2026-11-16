import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeMpcCeremonyManifest } from "./ceremony-manifest.js";
import { verifyCeremony } from "./verify-ceremony.js";

const { runCommandMock, ensureSnarkjsMock } = vi.hoisted(() => ({
  runCommandMock: vi.fn(),
  ensureSnarkjsMock: vi.fn(),
}));

vi.mock("@caatinga/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@caatinga/core")>();
  runCommandMock.mockImplementation(actual.runCommand);
  return { ...actual, runCommand: runCommandMock };
});

vi.mock("../install/lazy-install-zk-tools.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../install/lazy-install-zk-tools.js")>();
  ensureSnarkjsMock.mockImplementation(actual.ensureSnarkjs);
  return { ...actual, ensureSnarkjs: ensureSnarkjsMock };
});

describe("verifyCeremony (command failure vs invalid zkey)", () => {
  let tmpDir: string;

  async function seedPinnedManifest(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
    const zkeyBytes = "zkey-content";
    const vkBytes = JSON.stringify({ protocol: "groth16", curve: "bls12381", IC: [] });
    const ptauBytes = "ptau-content";
    await writeFile(path.join(dir, "circuit_final.zkey"), zkeyBytes);
    await writeFile(path.join(dir, "verification_key.json"), vkBytes);
    await writeFile(path.join(dir, "pot_final.ptau"), ptauBytes);

    const sha = (content: string) => createHash("sha256").update(content).digest("hex");
    await writeMpcCeremonyManifest(dir, {
      circuitHash: "a".repeat(64),
      publicSignals: 1,
      artifacts: {
        zkey: { path: "circuit_final.zkey", sha256: sha(zkeyBytes) },
        verificationKey: { path: "verification_key.json", sha256: sha(vkBytes) },
        ptau: { path: "pot_final.ptau", sha256: sha(ptauBytes) },
      },
    });
  }

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-verify-unit-"));
    ensureSnarkjsMock.mockResolvedValue("snarkjs");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("should_propagate_command_execution_failures_instead_of_reporting_tampered", async () => {
    await seedPinnedManifest(tmpDir);
    const cause = new Error("ENOENT: no such file or directory, open 'main.r1cs'");
    const commandError = new CaatingaError(
      "Command failed: snarkjs zkey verify main.r1cs pot_final.ptau circuit_final.zkey",
      CaatingaErrorCode.COMMAND_FAILED,
      "ENOENT: no such file or directory, open 'main.r1cs'",
      cause
    );
    runCommandMock.mockRejectedValueOnce(commandError);

    await expect(verifyCeremony({ artifactsDir: tmpDir })).rejects.toThrow(commandError);
  });

  it("should_report_ZK_CEREMONY_TAMPERED_when_snarkjs_rejects_an_invalid_zkey", async () => {
    await seedPinnedManifest(tmpDir);
    const cause = new Error("Process exited with code 1");
    const invalidKeyError = new CaatingaError(
      "Command failed: snarkjs zkey verify main.r1cs pot_final.ptau circuit_final.zkey",
      CaatingaErrorCode.COMMAND_FAILED,
      "[ERROR] snarkJS: INVALID:  Invalid alpha1",
      cause
    );
    runCommandMock.mockRejectedValueOnce(invalidKeyError);

    await expect(verifyCeremony({ artifactsDir: tmpDir })).rejects.toMatchObject({
      code: "ZK_CEREMONY_TAMPERED",
      message: expect.stringContaining("snarkjs zkey verify rejected"),
      cause: invalidKeyError,
    });
  });

  it("should_report_ZK_CEREMONY_TAMPERED_when_snarkjs_rejects_with_curve_mismatch", async () => {
    await seedPinnedManifest(tmpDir);
    const cause = new Error("Process exited with code 1");
    const curveMismatchError = new CaatingaError(
      "Command failed: snarkjs zkey verify main.r1cs pot_final.ptau circuit_final.zkey",
      CaatingaErrorCode.COMMAND_FAILED,
      "[ERROR] snarkJS: Curve does not match",
      cause
    );
    runCommandMock.mockRejectedValueOnce(curveMismatchError);

    await expect(verifyCeremony({ artifactsDir: tmpDir })).rejects.toMatchObject({
      code: "ZK_CEREMONY_TAMPERED",
      message: expect.stringContaining("snarkjs zkey verify rejected"),
      cause: curveMismatchError,
    });
  });
});
