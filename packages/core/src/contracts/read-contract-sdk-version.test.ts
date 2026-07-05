import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { readContractSorobanSdkVersions } from "./read-contract-sdk-version.js";

describe("readContractSorobanSdkVersions", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await import("node:fs/promises").then((fs) =>
        fs.rm(tmpDir, { recursive: true, force: true })
      );
    }
  });

  it("should_read_soroban_sdk_version_from_contract_cargo_toml", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-sdk-version-"));
    await mkdir(path.join(tmpDir, "contracts/counter"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "contracts/counter/Cargo.toml"),
      `[dependencies]\nsoroban-sdk = "22.0.1"\n`
    );

    const config: CaatingaConfig = {
      project: "app",
      defaultNetwork: "testnet",
      contracts: {
        counter: {
          path: "./contracts/counter",
          wasm: "./rel/counter.wasm",
          dependsOn: [],
          deployArgs: {},
        },
      },
      networks: {
        testnet: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      },
    };

    const versions = await readContractSorobanSdkVersions(config, tmpDir);
    expect(versions).toEqual([
      {
        contract: "counter",
        sorobanSdk: "22.0.1",
        cargoPath: "contracts/counter/Cargo.toml",
      },
    ]);
  });
});
