import { describe, expect, it } from "vitest";
import { updateArtifact } from "./update-artifact.js";
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
});
