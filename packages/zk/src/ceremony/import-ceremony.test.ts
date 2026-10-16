import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashCircuitSources, importCeremony } from "./import-ceremony.js";
import {
  assertCeremonyMatchesCircuit,
  MPC_CEREMONY_TYPE,
  readCeremonyManifest,
  writeMpcCeremonyManifest,
} from "./dev-ceremony.js";
import { ZkError } from "../errors/ZkError.js";

const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@caatinga/core")>();
  return { ...actual, runCommand: runCommandMock };
});

vi.mock("../install/lazy-install-zk-tools.js", () => ({
  ensureSnarkjs: vi.fn(async () => "snarkjs"),
}));

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-ceremony-"));
  runCommandMock.mockReset();
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

/** A Groth16 VK with `ic.length === publicSignals + 1`. */
function verificationKey(publicSignals: number) {
  return {
    protocol: "groth16",
    curve: "bls12381",
    // `IC` uppercase, as the pinned snarkjs version exports it.
    IC: Array.from({ length: publicSignals + 1 }, (_, i) => [`0x${i}`, "0x00"]),
  };
}

async function seedCircuit(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "main.circom"), "template Main() { signal input a; }");
  return dir;
}

async function seedCompiledArtifacts(dir: string, publicSignals: number): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "main.r1cs"), "r1cs-bytes");
  await mkdir(path.join(dir, "main_js"), { recursive: true });
  await writeFile(path.join(dir, "main_js", "main.wasm"), "wasm-bytes");
  // The exact wording `snarkjs r1cs info` prints — the implementation matches
  // on these lines, so a fixture that paraphrases them proves nothing.
  runCommandMock.mockResolvedValue({
    stdout: [
      "Curve: bls12-381",
      "# of Wires: 3",
      "# of Constraints: 1",
      "# of Private Inputs: 0",
      `# of Public Inputs: ${publicSignals}`,
      "# of Labels: 4",
      `# of Outputs: 0`,
    ].join("\n"),
    stderr: "",
    exitCode: 0,
  });
}

async function seedCeremonyOutput(dir: string, publicSignals: number): Promise<string> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "circuit_final.zkey"), `zkey-${publicSignals}-${"x".repeat(32)}`);
  await writeFile(
    path.join(dir, "verification_key.json"),
    JSON.stringify(verificationKey(publicSignals))
  );
  return dir;
}

describe("hashCircuitSources", () => {
  it("should_be_stable_for_the_same_sources", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));

    const first = await hashCircuitSources(circuitPath);
    const second = await hashCircuitSources(circuitPath);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should_change_when_the_circuit_source_changes", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const before = await hashCircuitSources(circuitPath);

    await writeFile(path.join(circuitPath, "main.circom"), "template Main() { signal input b; }");
    const after = await hashCircuitSources(circuitPath);

    expect(after).not.toBe(before);
  });

  it("should_fail_when_no_circom_sources_are_present", async () => {
    const empty = path.join(tmpRoot, "empty");
    await mkdir(empty, { recursive: true });

    await expect(hashCircuitSources(empty)).rejects.toThrow(
      expect.objectContaining({ code: "ZK_CEREMONY_INCOMPATIBLE" })
    );
  });
});

describe("importCeremony", () => {
  const publicSignals = 2;

  it("should_copy_the_artifacts_and_write_an_mpc_manifest", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    const ceremonyDir = await seedCeremonyOutput(path.join(tmpRoot, "ceremony"), publicSignals);
    await seedCompiledArtifacts(artifactsDir, publicSignals);

    const result = await importCeremony({
      circuitName: "main",
      circuitPath,
      artifactsDir,
      ceremonyDir,
    });

    expect(result.publicSignals).toBe(publicSignals);

    const manifest = await readCeremonyManifest(artifactsDir);
    expect(manifest?.type).toBe(MPC_CEREMONY_TYPE);
    if (manifest?.type !== MPC_CEREMONY_TYPE) {
      throw new Error("expected an MPC manifest");
    }
    expect(manifest.publicSignals).toBe(publicSignals);
    expect(manifest.source).toBe(ceremonyDir);
  });

  it("should_pin_every_artifact_by_sha256_and_record_provenance", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    const ceremonyDir = await seedCeremonyOutput(path.join(tmpRoot, "ceremony"), publicSignals);
    await writeFile(path.join(ceremonyDir, "pot12_final.ptau"), "ptau-bytes");
    await seedCompiledArtifacts(artifactsDir, publicSignals);

    await importCeremony({
      circuitName: "main",
      circuitPath,
      artifactsDir,
      ceremonyDir,
      provenance: {
        sourceUrl: "https://example.org/ceremony",
        ceremony: "multiplier-2026",
        participants: 12,
        retrievedAt: "2026-10-01T00:00:00.000Z",
      },
    });

    const manifest = await readCeremonyManifest(artifactsDir);
    if (manifest?.type !== MPC_CEREMONY_TYPE) {
      throw new Error("expected an MPC manifest");
    }
    const sha = async (relative: string) =>
      createHash("sha256")
        .update(await readFile(path.join(artifactsDir, relative)))
        .digest("hex");

    expect(manifest.version).toBe(2);
    expect(manifest.artifacts).toEqual({
      zkey: { path: "circuit_final.zkey", sha256: await sha("circuit_final.zkey") },
      verificationKey: {
        path: "verification_key.json",
        sha256: await sha("verification_key.json"),
      },
      r1cs: { path: "main.r1cs", sha256: await sha("main.r1cs") },
      wasm: { path: path.join("main_js", "main.wasm"), sha256: await sha("main_js/main.wasm") },
      ptau: { path: "pot12_final.ptau", sha256: await sha("pot12_final.ptau") },
    });
    expect(manifest.provenance).toEqual({
      sourceUrl: "https://example.org/ceremony",
      ceremony: "multiplier-2026",
      participants: 12,
      retrievedAt: "2026-10-01T00:00:00.000Z",
      curve: "bls12381",
    });
  });

  it("should_fail_when_the_ceremony_is_missing_the_proving_key", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    await seedCompiledArtifacts(artifactsDir, publicSignals);

    const emptyCeremony = path.join(tmpRoot, "empty-ceremony");
    await mkdir(emptyCeremony, { recursive: true });

    await expect(
      importCeremony({ circuitName: "main", circuitPath, artifactsDir, ceremonyDir: emptyCeremony })
    ).rejects.toThrow(expect.objectContaining({ code: "ZK_CEREMONY_INCOMPATIBLE" }));
  });

  it("should_fail_when_the_verification_key_belongs_to_a_different_circuit", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    // Circuit declares 2 public signals, ceremony VK implies 3.
    const ceremonyDir = await seedCeremonyOutput(path.join(tmpRoot, "ceremony"), 3);
    await seedCompiledArtifacts(artifactsDir, publicSignals);

    await expect(
      importCeremony({ circuitName: "main", circuitPath, artifactsDir, ceremonyDir })
    ).rejects.toThrow(expect.objectContaining({ code: "ZK_CEREMONY_INCOMPATIBLE" }));
  });

  it("should_fail_when_the_circuit_has_not_been_compiled_yet", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    await mkdir(artifactsDir, { recursive: true });
    const ceremonyDir = await seedCeremonyOutput(path.join(tmpRoot, "ceremony"), publicSignals);

    await expect(
      importCeremony({ circuitName: "main", circuitPath, artifactsDir, ceremonyDir })
    ).rejects.toThrow(expect.objectContaining({ code: "ZK_CEREMONY_INCOMPATIBLE" }));
  });

  it("should_fail_when_the_verification_key_is_not_a_groth16_key", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    await seedCompiledArtifacts(artifactsDir, publicSignals);

    const ceremonyDir = path.join(tmpRoot, "ceremony");
    await mkdir(ceremonyDir, { recursive: true });
    await writeFile(path.join(ceremonyDir, "circuit_final.zkey"), "zkey");
    await writeFile(
      path.join(ceremonyDir, "verification_key.json"),
      JSON.stringify({ protocol: "plonk", IC: verificationKey(publicSignals).IC })
    );

    await expect(
      importCeremony({ circuitName: "main", circuitPath, artifactsDir, ceremonyDir })
    ).rejects.toThrow(expect.objectContaining({ code: "ZK_CEREMONY_INCOMPATIBLE" }));
  });

  it("should_preserve_a_powers_of_tau_file_shipped_with_the_ceremony", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    await seedCompiledArtifacts(artifactsDir, publicSignals);

    const ceremonyDir = await seedCeremonyOutput(path.join(tmpRoot, "ceremony"), publicSignals);
    await writeFile(path.join(ceremonyDir, "powersOfTau28_hez_final_12.ptau"), "ptau-bytes");

    const result = await importCeremony({
      circuitName: "main",
      circuitPath,
      artifactsDir,
      ceremonyDir,
    });

    expect(result.ptauPath).toBe(path.join(artifactsDir, "powersOfTau28_hez_final_12.ptau"));
  });

  it("should_replace_a_stale_mpc_manifest_from_a_different_circuit", async () => {
    const circuitPath = await seedCircuit(path.join(tmpRoot, "circuits"));
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    await seedCompiledArtifacts(artifactsDir, publicSignals);
    await writeMpcCeremonyManifest(artifactsDir, {
      circuitHash: "a".repeat(64),
      publicSignals: 99,
    });

    const ceremonyDir = await seedCeremonyOutput(path.join(tmpRoot, "ceremony"), publicSignals);

    const result = await importCeremony({
      circuitName: "main",
      circuitPath,
      artifactsDir,
      ceremonyDir,
    });

    expect(result.publicSignals).toBe(publicSignals);
    const manifest = await readCeremonyManifest(artifactsDir);
    if (manifest?.type !== MPC_CEREMONY_TYPE) {
      throw new Error("expected an MPC manifest");
    }
    expect(manifest.circuitHash).toBe(result.circuitHash);
  });
});

describe("assertCeremonyMatchesCircuit", () => {
  it("should_pass_when_the_hash_matches", async () => {
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    await mkdir(artifactsDir, { recursive: true });
    await writeMpcCeremonyManifest(artifactsDir, {
      circuitHash: "b".repeat(64),
      publicSignals: 1,
    });

    await expect(
      assertCeremonyMatchesCircuit(artifactsDir, "b".repeat(64))
    ).resolves.toBeUndefined();
  });

  it("should_fail_when_the_hash_differs", async () => {
    const artifactsDir = path.join(tmpRoot, ".artifacts/zk/main");
    await mkdir(artifactsDir, { recursive: true });
    await writeMpcCeremonyManifest(artifactsDir, {
      circuitHash: "c".repeat(64),
      publicSignals: 1,
    });

    await expect(assertCeremonyMatchesCircuit(artifactsDir, "d".repeat(64))).rejects.toThrow(
      expect.objectContaining({ code: "ZK_CEREMONY_INCOMPATIBLE" })
    );
  });

  it("should_pass_when_no_manifest_is_present", async () => {
    const artifactsDir = path.join(tmpRoot, "empty");
    await mkdir(artifactsDir, { recursive: true });

    await expect(
      assertCeremonyMatchesCircuit(artifactsDir, "e".repeat(64))
    ).resolves.toBeUndefined();
  });
});

describe("ZkError", () => {
  it("should_carry_a_code_and_hint", () => {
    const error = new ZkError("boom", "ZK_CEREMONY_INCOMPATIBLE", "fix it");
    expect(error.code).toBe("ZK_CEREMONY_INCOMPATIBLE");
    expect(error.hint).toBe("fix it");
  });
});
