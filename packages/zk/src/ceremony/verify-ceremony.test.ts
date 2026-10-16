import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "@caatinga/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureSnarkjs } from "../install/lazy-install-zk-tools.js";
import { MPC_CEREMONY_TYPE, readCeremonyManifest } from "./dev-ceremony.js";
import { importCeremony } from "./import-ceremony.js";
import { verifyCeremony } from "./verify-ceremony.js";

/**
 * Runs `ctg zk verify-ceremony`'s logic against real snarkjs: a tiny BLS12-381
 * ceremony (power 8) is generated from the zk-starter multiplier circuit, then
 * imported and verified — including the cases a mocked snarkjs could not prove:
 * a VK that is not the zkey's, and a ptau from an unrelated ceremony.
 *
 * Opt-in because it downloads snarkjs on first use: set CAATINGA_ZK_TOOLS_TESTS=1.
 */

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../test/fixtures/multiplier"
);
const runRealTools = process.env.CAATINGA_ZK_TOOLS_TESTS === "1";

describe.skipIf(!runRealTools)("verifyCeremony (real snarkjs)", () => {
  let root: string;
  let snarkjs: string;

  async function snark(...args: string[]): Promise<void> {
    await runCommand(snarkjs, args, { cwd: root });
  }

  /** Phase 1 + phase 2 for the multiplier; returns the ceremony output dir. */
  async function runCeremony(name: string): Promise<string> {
    const dir = path.join(root, name);
    await mkdir(dir, { recursive: true });
    const p = (file: string) => path.join(dir, file);

    await snark("powersoftau", "new", "bls12-381", "8", p("pot_0000.ptau"));
    await snark(
      "powersoftau",
      "contribute",
      p("pot_0000.ptau"),
      p("pot_0001.ptau"),
      "--name=a",
      `-e=${name}-1`
    );
    await snark("powersoftau", "prepare", "phase2", p("pot_0001.ptau"), p("pot_final.ptau"));
    await snark(
      "groth16",
      "setup",
      path.join(fixturesDir, "main.r1cs"),
      p("pot_final.ptau"),
      p("c0.zkey")
    );
    await snark(
      "zkey",
      "contribute",
      p("c0.zkey"),
      p("circuit_final.zkey"),
      "--name=b",
      `-e=${name}-2`
    );
    await snark(
      "zkey",
      "export",
      "verificationkey",
      p("circuit_final.zkey"),
      p("verification_key.json")
    );
    await rm(p("pot_0000.ptau"));
    await rm(p("pot_0001.ptau"));
    return dir;
  }

  /** A fresh project with the compiled circuit, ready for `importCeremony`. */
  async function project(name: string): Promise<{ circuitPath: string; artifactsDir: string }> {
    const circuitPath = path.join(root, name, "circuits");
    const artifactsDir = path.join(root, name, ".artifacts/zk/main");
    await mkdir(circuitPath, { recursive: true });
    await mkdir(artifactsDir, { recursive: true });
    await copyFile(path.join(fixturesDir, "main.circom"), path.join(circuitPath, "main.circom"));
    await copyFile(path.join(fixturesDir, "main.r1cs"), path.join(artifactsDir, "main.r1cs"));
    return { circuitPath, artifactsDir };
  }

  let ceremony: string;
  let unrelated: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-verify-"));
    snarkjs = await ensureSnarkjs();
    ceremony = await runCeremony("ceremony");
    unrelated = await runCeremony("unrelated");
  }, 300_000);

  afterAll(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("verifies an untouched imported ceremony and stamps verifiedAt", async () => {
    const { circuitPath, artifactsDir } = await project("ok");
    await importCeremony({ circuitName: "main", circuitPath, artifactsDir, ceremonyDir: ceremony });

    const result = await verifyCeremony({ artifactsDir });

    expect(result.zkey).toBe("verified");
    expect(result.verificationKeyMatchesZkey).toBe(true);
    const manifest = await readCeremonyManifest(artifactsDir);
    expect(manifest?.type === MPC_CEREMONY_TYPE && manifest.verifiedAt).toMatch(/^\d{4}-/);
  }, 120_000);

  it("rejects a verification key that does not belong to the zkey", async () => {
    const mixed = path.join(root, "mixed");
    await mkdir(mixed, { recursive: true });
    await copyFile(
      path.join(ceremony, "circuit_final.zkey"),
      path.join(mixed, "circuit_final.zkey")
    );
    await copyFile(path.join(ceremony, "pot_final.ptau"), path.join(mixed, "pot_final.ptau"));
    // Same circuit, same public-signal count: import cannot tell them apart.
    await copyFile(
      path.join(unrelated, "verification_key.json"),
      path.join(mixed, "verification_key.json")
    );

    const { circuitPath, artifactsDir } = await project("mixed-vk");
    await importCeremony({ circuitName: "main", circuitPath, artifactsDir, ceremonyDir: mixed });

    await expect(verifyCeremony({ artifactsDir })).rejects.toMatchObject({
      code: "ZK_CEREMONY_TAMPERED",
      message: expect.stringContaining("is not the verification key"),
    });
  }, 120_000);

  it("rejects a zkey that does not derive from the imported powers-of-tau", async () => {
    const mixed = path.join(root, "mixed-ptau");
    await mkdir(mixed, { recursive: true });
    await copyFile(
      path.join(ceremony, "circuit_final.zkey"),
      path.join(mixed, "circuit_final.zkey")
    );
    await copyFile(
      path.join(ceremony, "verification_key.json"),
      path.join(mixed, "verification_key.json")
    );
    await copyFile(path.join(unrelated, "pot_final.ptau"), path.join(mixed, "pot_final.ptau"));

    const { circuitPath, artifactsDir } = await project("mixed-ptau");
    await importCeremony({ circuitName: "main", circuitPath, artifactsDir, ceremonyDir: mixed });

    await expect(verifyCeremony({ artifactsDir })).rejects.toMatchObject({
      code: "ZK_CEREMONY_TAMPERED",
      message: expect.stringContaining("zkey verify rejected"),
    });
  }, 120_000);
});
