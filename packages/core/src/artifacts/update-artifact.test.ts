import { describe, expect, it } from "vitest";
import { updateArtifact, restoreArtifactFromHistory } from "./update-artifact.js";
import type { CaatingaArtifacts } from "./artifact.schema.js";

describe("updateArtifact", () => {
  it("preserves artifacts from other networks", () => {
    const artifacts: CaatingaArtifacts = {
      project: "app",
      version: 1,
      networks: {
        mainnet: {
          contracts: {
            counter: {
              contractId: "CMAIN",
              wasmHash: "main",
              deployedAt: "2026-05-11T00:00:00.000Z",
              sourcePath: "./contracts/counter",
              wasmPath: "./target/main.wasm",
              dependencies: [],
              resolvedDeployArgs: {},
            },
          },
          dependencyGraph: {},
        },
      },
    };

    const updated = updateArtifact(artifacts, "testnet", "counter", {
      contractId: "CTEST",
      wasmHash: "test",
      deployedAt: "2026-05-11T00:00:00.000Z",
      sourcePath: "./contracts/counter",
      wasmPath: "./target/test.wasm",
      dependencies: [],
      resolvedDeployArgs: {},
    });

    expect(updated.networks.mainnet.contracts.counter.contractId).toBe("CMAIN");
    expect(updated.networks.testnet.contracts.counter.contractId).toBe("CTEST");
  });

  it("appends_history_and_bumps_schema_on_supersede", () => {
    const artifacts: CaatingaArtifacts = {
      project: "app",
      version: 1,
      networks: {
        testnet: {
          contracts: {
            counter: {
              contractId: "COLD",
              wasmHash: "old",
              deployedAt: "2026-05-11T00:00:00.000Z",
              sourcePath: "./contracts/counter",
              wasmPath: "./target/counter.wasm",
              dependencies: [],
              resolvedDeployArgs: {},
            },
          },
          dependencyGraph: {},
        },
      },
    };

    const updated = updateArtifact(
      artifacts,
      "testnet",
      "counter",
      {
        contractId: "CNEW",
        wasmHash: "new",
        deployedAt: "2026-06-21T00:00:00.000Z",
        sourcePath: "./contracts/counter",
        wasmPath: "./target/counter.wasm",
        dependencies: [],
        resolvedDeployArgs: {},
      },
      { supersedeReason: "upgrade" }
    );

    expect(updated.version).toBe(2);
    expect(updated.networks.testnet.contracts.counter.contractId).toBe("CNEW");
    expect(updated.networks.testnet.contracts.counter.history).toHaveLength(1);
    expect(updated.networks.testnet.contracts.counter.history?.[0]?.contractId).toBe("COLD");
  });

  it("throws_when_rollback_target_missing_from_history", () => {
    const artifacts: CaatingaArtifacts = {
      project: "app",
      version: 2,
      networks: {
        testnet: {
          contracts: {
            counter: {
              contractId: "CNEW",
              wasmHash: "new",
              deployedAt: "2026-06-21T00:00:00.000Z",
              sourcePath: "./contracts/counter",
              wasmPath: "./target/counter.wasm",
              dependencies: [],
              resolvedDeployArgs: {},
              history: [],
            },
          },
          dependencyGraph: {},
        },
      },
    };

    expect(() =>
      restoreArtifactFromHistory({
        artifacts,
        networkName: "testnet",
        contractName: "counter",
        contractId: "CMISSING",
      })
    ).toThrowError(
      expect.objectContaining({
        code: "CAATINGA_ROLLBACK_TARGET_NOT_FOUND",
      })
    );
  });
});
