import fs from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CaatingaConfig } from "@caatinga/core";
import { digestCeremonyArtifacts, writeDevCeremonyManifest } from "@caatinga/zk";
import {
  assertEmbedVkInvokeSupported,
  assertProtocolForZkVerifiers,
  assertZkBuildNetworkAllowed,
  assertZkVerifierDeployAllowed,
  listZkCircuitsForVerifier,
} from "./zk-guardrails.js";

const tmpArtifacts = path.join(process.cwd(), ".artifacts", "zk", "guardrail-main");

const zkConfig: CaatingaConfig = {
  project: "zk-app",
  defaultNetwork: "testnet",
  contracts: {
    verifier: {
      path: "./contracts/verifier",
      wasm: "./target/verifier.wasm",
      dependsOn: [],
      deployArgs: {},
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    mainnet: {
      rpcUrl: "https://mainnet.sorobanrpc.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
  },
  zk: {
    circuits: {
      "guardrail-main": {
        path: "./circuits",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier",
      },
    },
  },
};

// Scoped to this file's own circuit directory: removing the whole
// `.artifacts/zk` tree races against other test files that use
// `.artifacts/zk/main` while the suite runs in parallel.
afterEach(async () => {
  await rm(tmpArtifacts, { recursive: true, force: true });
});

describe("zk-guardrails", () => {
  it("should_list_circuits_for_verifier_contract", () => {
    expect(listZkCircuitsForVerifier(zkConfig, "verifier")).toEqual(["guardrail-main"]);
    expect(listZkCircuitsForVerifier(zkConfig, "other")).toEqual([]);
  });

  it("should_block_zk_build_on_mainnet_default_network", async () => {
    await expect(
      assertZkBuildNetworkAllowed({
        networkName: "mainnet",
        allowDevCeremony: false,
      })
    ).rejects.toMatchObject({ code: "ZK_DEV_CEREMONY_BLOCKED" });
  });

  it("should_block_verifier_deploy_on_mainnet_with_dev_ceremony", async () => {
    await mkdir(tmpArtifacts, { recursive: true });
    await writeDevCeremonyManifest(tmpArtifacts);

    await expect(
      assertZkVerifierDeployAllowed({
        config: zkConfig,
        contractNames: ["verifier"],
        networkName: "mainnet",
        allowDevCeremony: false,
      })
    ).rejects.toMatchObject({ code: "ZK_DEV_CEREMONY_BLOCKED" });
  });

  it("should_block_zk_build_on_a_custom_named_mainnet_by_passphrase", async () => {
    await expect(
      assertZkBuildNetworkAllowed({
        networkName: "pubnet",
        networkConfig: zkConfig.networks.mainnet,
        allowDevCeremony: false,
      })
    ).rejects.toMatchObject({ code: "ZK_DEV_CEREMONY_BLOCKED" });
  });

  it("should_block_verifier_deploy_on_a_custom_named_mainnet_by_passphrase", async () => {
    await mkdir(tmpArtifacts, { recursive: true });
    await writeDevCeremonyManifest(tmpArtifacts);

    await expect(
      assertZkVerifierDeployAllowed({
        config: zkConfig,
        contractNames: ["verifier"],
        networkName: "production",
        networkConfig: zkConfig.networks.mainnet,
        allowDevCeremony: false,
      })
    ).rejects.toMatchObject({ code: "ZK_DEV_CEREMONY_BLOCKED" });
  });

  it("should_allow_zk_build_on_testnet_with_its_config", async () => {
    await expect(
      assertZkBuildNetworkAllowed({
        networkName: "testnet",
        networkConfig: zkConfig.networks.testnet,
        allowDevCeremony: false,
      })
    ).resolves.toBeUndefined();
  });

  it("should_block_embedded_vk_invoke_when_vk_rs_is_missing", () => {
    expect(() =>
      assertEmbedVkInvokeSupported({ embedVk: true, verifierSrcDir: "/nonexistent/verifier/src" })
    ).toThrow(expect.objectContaining({ code: "CAATINGA_ZK_EMBED_VK_UNSUPPORTED" }));
  });

  it("should_block_embedded_vk_invoke_while_vk_rs_is_the_scaffold_placeholder", () => {
    const placeholder = fs.mkdtempSync(path.join(os.tmpdir(), "caatinga-vk-src-"));
    const src = path.join(placeholder, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(
      path.join(src, "vk.rs"),
      "// PLACEHOLDER verification key shipped with the scaffold.\npub fn embedded_vk() {}\n"
    );

    try {
      expect(() => assertEmbedVkInvokeSupported({ embedVk: true, verifierSrcDir: src })).toThrow(
        expect.objectContaining({ code: "CAATINGA_ZK_EMBED_VK_UNSUPPORTED" })
      );
    } finally {
      fs.rmSync(placeholder, { recursive: true, force: true });
    }
  });

  it("should_allow_embedded_vk_invoke_once_vk_rs_has_real_coordinates", () => {
    const real = fs.mkdtempSync(path.join(os.tmpdir(), "caatinga-vk-src-"));
    const src = path.join(real, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(
      path.join(src, "vk.rs"),
      "// @generated by ctg zk build --embed-vk\npub fn embedded_vk() {}\n"
    );

    try {
      expect(() =>
        assertEmbedVkInvokeSupported({ embedVk: true, verifierSrcDir: src })
      ).not.toThrow();
    } finally {
      fs.rmSync(real, { recursive: true, force: true });
    }
  });

  it("should_allow_invoke_without_embedded_vk", () => {
    expect(() => assertEmbedVkInvokeSupported({ embedVk: false })).not.toThrow();
  });

  it("should_skip_the_protocol_pre_flight_when_no_verifier_contract_is_deployed", async () => {
    await expect(
      assertProtocolForZkVerifiers({
        config: zkConfig,
        contractNames: ["unrelated-contract"],
        networkName: "testnet",
        networkConfig: zkConfig.networks.testnet!,
        operation: "ctg deploy",
      })
    ).resolves.toBeUndefined();
  });

  it("should_block_a_verifier_deploy_below_the_minimum_protocol_version", async () => {
    await expect(
      assertProtocolForZkVerifiers({
        config: zkConfig,
        contractNames: ["verifier"],
        networkName: "testnet",
        networkConfig: zkConfig.networks.testnet!,
        operation: "ctg deploy verifier",
        protocolVersion: 26,
      })
    ).rejects.toMatchObject({ code: "CAATINGA_ZK_PROTOCOL_VERSION_UNSUPPORTED" });
  });

  it("should_allow_verifier_deploy_at_the_minimum_protocol_version", async () => {
    await expect(
      assertProtocolForZkVerifiers({
        config: zkConfig,
        contractNames: ["verifier"],
        networkName: "testnet",
        networkConfig: zkConfig.networks.testnet!,
        operation: "ctg deploy verifier",
        protocolVersion: 27,
      })
    ).resolves.toBeUndefined();
  });

  it("should_allow_zk_build_on_mainnet_when_mpc_ceremony_artifacts_are_present", async () => {
    await mkdir(tmpArtifacts, { recursive: true });
    await writeFile(
      path.join(tmpArtifacts, "ceremony.json"),
      JSON.stringify({ type: "mpc-multi-party" })
    );

    await expect(
      assertZkBuildNetworkAllowed({
        networkName: "mainnet",
        allowDevCeremony: false,
        artifactsDir: tmpArtifacts,
      })
    ).resolves.toBeUndefined();
  });

  it("should_block_zk_build_on_mainnet_when_the_manifest_is_a_dev_ceremony", async () => {
    await mkdir(tmpArtifacts, { recursive: true });
    await writeFile(
      path.join(tmpArtifacts, "ceremony.json"),
      JSON.stringify({ type: "dev-single-party" })
    );

    await expect(
      assertZkBuildNetworkAllowed({
        networkName: "mainnet",
        allowDevCeremony: false,
        artifactsDir: tmpArtifacts,
      })
    ).rejects.toMatchObject({ code: "ZK_DEV_CEREMONY_BLOCKED" });
  });

  it("should_allow_a_verifier_deploy_on_mainnet_with_mpc_ceremony_artifacts", async () => {
    await mkdir(tmpArtifacts, { recursive: true });
    await writeFile(path.join(tmpArtifacts, "circuit_final.zkey"), "zkey");
    await writeFile(path.join(tmpArtifacts, "verification_key.json"), "{}");
    await writeFile(
      path.join(tmpArtifacts, "ceremony.json"),
      JSON.stringify({
        type: "mpc-multi-party",
        version: 2,
        artifacts: await digestCeremonyArtifacts(tmpArtifacts, {
          zkey: "circuit_final.zkey",
          verificationKey: "verification_key.json",
        }),
      })
    );

    await expect(
      assertZkVerifierDeployAllowed({
        config: zkConfig,
        contractNames: ["verifier"],
        networkName: "mainnet",
        allowDevCeremony: false,
      })
    ).resolves.toBeUndefined();
  });

  it("should_block_a_verifier_deploy_on_mainnet_when_the_mpc_zkey_was_swapped", async () => {
    await mkdir(tmpArtifacts, { recursive: true });
    await writeFile(path.join(tmpArtifacts, "circuit_final.zkey"), "zkey");
    await writeFile(path.join(tmpArtifacts, "verification_key.json"), "{}");
    await writeFile(
      path.join(tmpArtifacts, "ceremony.json"),
      JSON.stringify({
        type: "mpc-multi-party",
        version: 2,
        artifacts: await digestCeremonyArtifacts(tmpArtifacts, {
          zkey: "circuit_final.zkey",
          verificationKey: "verification_key.json",
        }),
      })
    );
    await writeFile(path.join(tmpArtifacts, "circuit_final.zkey"), "dev-zkey");

    await expect(
      assertZkVerifierDeployAllowed({
        config: zkConfig,
        contractNames: ["verifier"],
        networkName: "mainnet",
        allowDevCeremony: true,
      })
    ).rejects.toMatchObject({ code: "ZK_CEREMONY_TAMPERED" });
  });
});
