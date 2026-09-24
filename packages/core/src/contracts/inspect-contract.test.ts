import { describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";

const readArtifacts = vi.hoisted(() => vi.fn());
const checkBinary = vi.hoisted(() => vi.fn());
const resolveContract = vi.hoisted(() => vi.fn());
const resolveWasmArtifactPath = vi.hoisted(() => vi.fn());
const hashWasm = vi.hoisted(() => vi.fn());
const verifyDependencyContract = vi.hoisted(() => vi.fn());

vi.mock("../artifacts/read-artifacts.js", () => ({ readArtifacts }));
vi.mock("../shell/check-binary.js", () => ({ checkBinary }));
vi.mock("./resolve-contract.js", () => ({ resolveContract }));
vi.mock("./wasm.js", () => ({ hashWasm, resolveWasmArtifactPath }));
vi.mock("./verify-dependency-contract.js", () => ({ verifyDependencyContract }));

import { inspectContract } from "./inspect-contract.js";

const contractId = `C${"A".repeat(55)}`;
const config: CaatingaConfig = {
  project: "app",
  defaultNetwork: "mainnet",
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./contracts/token/target/testnet.wasm",
      dependsOn: [],
      deployArgs: {},
    },
  },
  networks: {
    mainnet: {
      rpcUrl: "https://rpc.example.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
  },
};

describe("inspectContract", () => {
  it("uses the selected network artifact WASM path", async () => {
    const artifactWasmPath = "./deploy/mainnet-wasm/token.wasm";
    resolveContract.mockReturnValue({
      name: "token",
      config: config.contracts.token,
      sourcePath: "/tmp/app/contracts/token",
      wasmPath: "/tmp/app/contracts/token/target/testnet.wasm",
    });
    readArtifacts.mockResolvedValue({
      project: "app",
      version: 2,
      networks: {
        mainnet: {
          contracts: {
            token: {
              contractId,
              wasmHash: "a".repeat(64),
              deployedAt: "2026-09-24T00:00:00.000Z",
              sourcePath: "./contracts/token",
              wasmPath: artifactWasmPath,
              dependencies: [],
              resolvedDeployArgs: {},
            },
          },
          dependencyGraph: {},
        },
      },
    });
    resolveWasmArtifactPath.mockResolvedValue("/tmp/app/deploy/mainnet-wasm/token.wasm");
    hashWasm.mockResolvedValue("a".repeat(64));

    const result = await inspectContract({ config, contractName: "token", cwd: "/tmp/app" });

    expect(resolveWasmArtifactPath).toHaveBeenCalledWith(artifactWasmPath, {
      sourcePath: "/tmp/app/contracts/token",
    });
    expect(result.localWasm).toEqual({
      path: "/tmp/app/deploy/mainnet-wasm/token.wasm",
      hash: "a".repeat(64),
      matchesArtifact: true,
    });
  });
});
