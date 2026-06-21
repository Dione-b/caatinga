import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CaatingaConfig } from "@caatinga/core";
import { writeDevCeremonyManifest } from "@caatinga/zk";
import {
  assertZkBuildNetworkAllowed,
  assertZkVerifierDeployAllowed,
  listZkCircuitsForVerifier,
} from "./zk-guardrails.js";

const tmpArtifacts = path.join(process.cwd(), ".artifacts", "zk", "main");

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
      main: {
        path: "./circuits",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier",
      },
    },
  },
};

afterEach(async () => {
  await rm(path.join(process.cwd(), ".artifacts", "zk"), { recursive: true, force: true });
});

describe("zk-guardrails", () => {
  it("should_list_circuits_for_verifier_contract", () => {
    expect(listZkCircuitsForVerifier(zkConfig, "verifier")).toEqual(["main"]);
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
});
