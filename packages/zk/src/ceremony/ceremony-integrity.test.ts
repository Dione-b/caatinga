import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CaatingaErrorCode, toCaatingaError } from "@caatinga/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertCeremonyIntegrity,
  digestCeremonyArtifacts,
  findCeremonyMismatches,
} from "./ceremony-integrity.js";
import {
  assertDevCeremonyAllowed,
  MPC_CEREMONY_MANIFEST_VERSION,
  writeMpcCeremonyManifest,
} from "./dev-ceremony.js";

let artifactsDir: string;

beforeEach(async () => {
  artifactsDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-integrity-"));
  await writeFile(path.join(artifactsDir, "circuit_final.zkey"), Buffer.from([0x00, 0xff, 0x10]));
  await writeFile(path.join(artifactsDir, "verification_key.json"), '{"protocol":"groth16"}');
  await writeFile(path.join(artifactsDir, "pot12_final.ptau"), "ptau");
  await writeFile(path.join(artifactsDir, "main.r1cs"), "r1cs");
});

afterEach(async () => {
  await rm(artifactsDir, { recursive: true, force: true });
});

async function pin() {
  return digestCeremonyArtifacts(artifactsDir, {
    zkey: "circuit_final.zkey",
    verificationKey: "verification_key.json",
    ptau: "pot12_final.ptau",
    r1cs: "main.r1cs",
    wasm: path.join("main_js", "main.wasm"),
  });
}

describe("digestCeremonyArtifacts", () => {
  it("should_skip_optional_artifacts_that_do_not_exist", async () => {
    const digests = await pin();

    expect(digests.wasm).toBeUndefined();
    expect(digests.zkey.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should_fail_when_the_proving_key_is_missing", async () => {
    await rm(path.join(artifactsDir, "circuit_final.zkey"));

    await expect(pin()).rejects.toMatchObject({ code: "ZK_CEREMONY_INCOMPATIBLE" });
  });
});

describe("findCeremonyMismatches", () => {
  it("should_report_nothing_for_untouched_artifacts", async () => {
    const digests = await pin();

    await expect(findCeremonyMismatches(artifactsDir, digests)).resolves.toEqual([]);
  });

  it("should_flag_a_recompiled_r1cs_as_non_critical", async () => {
    const digests = await pin();
    await writeFile(path.join(artifactsDir, "main.r1cs"), "r1cs-recompiled");

    const [mismatch] = await findCeremonyMismatches(artifactsDir, digests);
    expect(mismatch).toMatchObject({ role: "r1cs", critical: false });
  });
});

describe("assertCeremonyIntegrity", () => {
  it("should_pass_when_critical_artifacts_are_unchanged", async () => {
    const artifacts = await pin();
    await writeFile(path.join(artifactsDir, "main.r1cs"), "r1cs-recompiled");

    await expect(
      assertCeremonyIntegrity({ artifactsDir, artifacts, operation: "ctg deploy verifier" })
    ).resolves.toBeUndefined();
  });

  it.each(["circuit_final.zkey", "verification_key.json", "pot12_final.ptau"])(
    "should_throw_ZK_CEREMONY_TAMPERED_when_%s_changes",
    async (file) => {
      const artifacts = await pin();
      await writeFile(path.join(artifactsDir, file), "swapped");

      await expect(
        assertCeremonyIntegrity({ artifactsDir, artifacts, operation: "ctg deploy verifier" })
      ).rejects.toMatchObject({ code: "ZK_CEREMONY_TAMPERED" });
    }
  );

  it("should_surface_CAATINGA_ZK_CEREMONY_TAMPERED_through_the_cli_error_path", async () => {
    const artifacts = await pin();
    await writeFile(path.join(artifactsDir, "circuit_final.zkey"), "swapped");

    const error = await assertCeremonyIntegrity({
      artifactsDir,
      artifacts,
      operation: "ctg deploy verifier",
    }).catch((caught: unknown) => caught);

    expect(toCaatingaError(error).code).toBe(CaatingaErrorCode.ZK_CEREMONY_TAMPERED);
  });

  it("should_throw_ZK_CEREMONY_TAMPERED_when_a_critical_artifact_is_deleted", async () => {
    const artifacts = await pin();
    await rm(path.join(artifactsDir, "verification_key.json"));

    await expect(
      assertCeremonyIntegrity({ artifactsDir, artifacts, operation: "ctg zk invoke main" })
    ).rejects.toThrow(/verification_key\.json is missing/);
  });

  it("should_throw_ZK_CEREMONY_TAMPERED_when_no_hashes_were_recorded", async () => {
    await expect(
      assertCeremonyIntegrity({ artifactsDir, operation: "ctg deploy verifier" })
    ).rejects.toMatchObject({ code: "ZK_CEREMONY_TAMPERED" });
  });
});

describe("assertDevCeremonyAllowed with an imported MPC ceremony", () => {
  const mainnet = {
    rpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  };

  async function writeManifest(withHashes: boolean) {
    await writeMpcCeremonyManifest(artifactsDir, {
      version: MPC_CEREMONY_MANIFEST_VERSION,
      circuitHash: "a".repeat(64),
      publicSignals: 1,
      ...(withHashes ? { artifacts: await pin() } : {}),
    });
  }

  it("should_allow_mainnet_while_the_artifacts_match", async () => {
    await writeManifest(true);

    await expect(
      assertDevCeremonyAllowed({
        networkName: "mainnet",
        networkConfig: mainnet,
        artifactsDir,
        allowDevCeremony: false,
        operation: "ctg deploy verifier",
      })
    ).resolves.toBeUndefined();
  });

  it("should_block_mainnet_with_a_swapped_zkey_even_with_allowDevCeremony", async () => {
    await writeManifest(true);
    await writeFile(path.join(artifactsDir, "circuit_final.zkey"), "dev-zkey");

    await expect(
      assertDevCeremonyAllowed({
        networkName: "mainnet",
        networkConfig: mainnet,
        artifactsDir,
        allowDevCeremony: true,
        operation: "ctg deploy verifier",
      })
    ).rejects.toMatchObject({ code: "ZK_CEREMONY_TAMPERED" });
  });

  it("should_block_mainnet_for_a_hand_edited_manifest_without_hashes", async () => {
    await writeManifest(false);

    await expect(
      assertDevCeremonyAllowed({
        networkName: "mainnet",
        networkConfig: mainnet,
        artifactsDir,
        allowDevCeremony: false,
        operation: "ctg zk invoke main",
      })
    ).rejects.toMatchObject({ code: "ZK_CEREMONY_TAMPERED" });
  });

  it("should_not_check_hashes_on_testnet", async () => {
    await writeManifest(true);
    await writeFile(path.join(artifactsDir, "circuit_final.zkey"), "changed");

    await expect(
      assertDevCeremonyAllowed({
        networkName: "testnet",
        networkConfig: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
        artifactsDir,
        allowDevCeremony: false,
        operation: "ctg deploy verifier",
      })
    ).resolves.toBeUndefined();
  });
});
