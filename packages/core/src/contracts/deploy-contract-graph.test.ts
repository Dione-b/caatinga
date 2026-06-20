import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { deployContractGraph } from "./deploy-contract-graph.js";

const deployContractMock = vi.hoisted(() => vi.fn());
const readArtifactsMock = vi.hoisted(() => vi.fn());
const verifyDependencyContractsMock = vi.hoisted(() => vi.fn());

vi.mock("./deploy-contract.js", () => ({
  deployContract: deployContractMock,
}));

vi.mock("../artifacts/read-artifacts.js", () => ({
  readArtifacts: readArtifactsMock,
}));

vi.mock("./verify-dependency-contract.js", () => ({
  verifyDependencyContracts: verifyDependencyContractsMock,
}));

const config: CaatingaConfig = {
  project: "marketplace-app",
  defaultNetwork: "testnet",
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./token.wasm",
      dependsOn: [],
      deployArgs: {},
    },
    marketplace: {
      path: "./contracts/marketplace",
      wasm: "./marketplace.wasm",
      dependsOn: ["token"],
      deployArgs: {
        tokenContractId: "${contracts.token.contractId}",
      },
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated",
  },
};

describe("deployContractGraph", () => {
  beforeEach(() => {
    deployContractMock.mockClear();
    readArtifactsMock.mockClear();
    verifyDependencyContractsMock.mockClear();
    verifyDependencyContractsMock.mockResolvedValue(undefined);
  });

  it("deploys dependencies before dependents", async () => {
    const deployCalls: Array<{
      contractName: string;
      resolvedDeployArgs: Record<string, string | number | boolean>;
      dependencies: string[];
    }> = [];
    const store: {
      networks: {
        testnet: {
          contracts: Record<string, { contractId: string }>;
          dependencyGraph: Record<string, string[]>;
        };
      };
    } = {
      networks: {
        testnet: { contracts: {}, dependencyGraph: {} },
      },
    };

    readArtifactsMock.mockImplementation(async () => ({
      project: "marketplace-app",
      version: 1 as const,
      networks: store.networks,
    }));

    deployContractMock.mockImplementation(
      async (opts: {
        contractName: string;
        resolvedDeployArgs: Record<string, string | number | boolean>;
        dependencies: string[];
      }) => {
        deployCalls.push({
          contractName: opts.contractName,
          resolvedDeployArgs: opts.resolvedDeployArgs,
          dependencies: opts.dependencies,
        });
        const id = opts.contractName === "token" ? "C".padEnd(56, "A") : "C".padEnd(56, "B");
        store.networks.testnet.contracts[opts.contractName] = { contractId: id };
        store.networks.testnet.dependencyGraph[opts.contractName] = opts.dependencies;
        return { contractId: id, contract: { name: opts.contractName } };
      }
    );

    const result = await deployContractGraph({
      config,
      contractName: "marketplace",
      networkName: "testnet",
      source: "alice",
      cwd: "/tmp/app",
      includeDependencies: true,
      force: false,
    });

    expect(result.deployedContracts.map((contract) => contract.name)).toEqual([
      "token",
      "marketplace",
    ]);
    expect(result.skippedContracts).toEqual([]);
    expect(deployCalls.map((call) => call.contractName)).toEqual(["token", "marketplace"]);
    expect(store.networks.testnet.dependencyGraph.marketplace).toEqual(["token"]);
    expect(deployContractMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ contractName: "token" })
    );
    expect(deployContractMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        contractName: "marketplace",
        resolvedDeployArgs: { tokenContractId: "C".padEnd(56, "A") },
      })
    );
  });

  it("fails --no-deps when dependency artifact is missing", async () => {
    readArtifactsMock.mockResolvedValue({
      project: "marketplace-app",
      version: 1,
      networks: { testnet: { contracts: {}, dependencyGraph: {} } },
    });

    await expect(
      deployContractGraph({
        config,
        contractName: "marketplace",
        networkName: "testnet",
        source: "alice",
        cwd: "/tmp/app",
        includeDependencies: false,
        force: false,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND });
  });

  it("deploys_all_contracts_in_topological_order_when_contractName_is_omitted", async () => {
    const store: {
      networks: {
        testnet: {
          contracts: Record<string, { contractId: string }>;
          dependencyGraph: Record<string, string[]>;
        };
      };
    } = {
      networks: {
        testnet: { contracts: {}, dependencyGraph: {} },
      },
    };

    readArtifactsMock.mockImplementation(async () => ({
      project: "marketplace-app",
      version: 1 as const,
      networks: store.networks,
    }));

    deployContractMock.mockImplementation(async (opts: { contractName: string }) => {
      const id = opts.contractName === "token" ? "C".padEnd(56, "A") : "C".padEnd(56, "B");
      store.networks.testnet.contracts[opts.contractName] = { contractId: id };
      return { contractId: id, contract: { name: opts.contractName } };
    });

    const result = await deployContractGraph({
      config,
      networkName: "testnet",
      source: "alice",
      cwd: "/tmp/app",
      includeDependencies: true,
      force: false,
    });

    expect(result.deployedContracts.map((c) => c.name)).toEqual(["token", "marketplace"]);
    expect(result.skippedContracts).toEqual([]);
    expect(deployContractMock).toHaveBeenCalledTimes(2);
  });

  it("should_report_skipped_contracts_when_artifact_already_has_contract_id", async () => {
    const existingId = "C".padEnd(56, "X");
    readArtifactsMock.mockResolvedValue({
      project: "marketplace-app",
      version: 1,
      networks: {
        testnet: {
          contracts: { token: { contractId: existingId } },
          dependencyGraph: {},
        },
      },
    });

    const result = await deployContractGraph({
      config: {
        ...config,
        contracts: {
          token: config.contracts.token,
        },
      },
      contractName: "token",
      networkName: "testnet",
      source: "alice",
      cwd: "/tmp/app",
      includeDependencies: true,
      force: false,
    });

    expect(deployContractMock).not.toHaveBeenCalled();
    expect(result.skippedContracts).toEqual([
      expect.objectContaining({
        name: "token",
        contractId: existingId,
        network: "testnet",
        reason: "already-deployed",
      }),
    ]);
    expect(result.deployedContracts).toEqual([]);
  });

  it("should_report_mixed_skipped_and_deployed_contracts", async () => {
    const existingToken = "C".padEnd(56, "X");
    const store: {
      networks: {
        testnet: {
          contracts: Record<string, { contractId: string }>;
          dependencyGraph: Record<string, string[]>;
        };
      };
    } = {
      networks: {
        testnet: {
          contracts: { token: { contractId: existingToken } },
          dependencyGraph: { token: [] },
        },
      },
    };

    readArtifactsMock.mockImplementation(async () => ({
      project: "marketplace-app",
      version: 1 as const,
      networks: store.networks,
    }));

    deployContractMock.mockImplementation(async (opts: { contractName: string }) => {
      const id = "C".padEnd(56, "B");
      store.networks.testnet.contracts[opts.contractName] = { contractId: id };
      store.networks.testnet.dependencyGraph[opts.contractName] =
        opts.contractName === "marketplace" ? ["token"] : [];
      return { contractId: id, contract: { name: opts.contractName }, skipped: false };
    });

    const result = await deployContractGraph({
      config,
      networkName: "testnet",
      source: "alice",
      cwd: "/tmp/app",
      includeDependencies: true,
      force: false,
    });

    expect(deployContractMock).toHaveBeenCalledTimes(1);
    expect(deployContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ contractName: "marketplace" })
    );
    expect(result.skippedContracts).toEqual([
      expect.objectContaining({
        name: "token",
        contractId: existingToken,
        network: "testnet",
        reason: "already-deployed",
      }),
    ]);
    expect(result.deployedContracts).toEqual([
      { name: "marketplace", contractId: "C".padEnd(56, "B") },
    ]);
  });

  it("should_call_deploy_for_each_contract_when_force_true_even_if_artifacts_have_ids", async () => {
    const existingToken = "C".padEnd(56, "X");
    const existingMarket = "C".padEnd(56, "Y");
    const store: {
      networks: {
        testnet: {
          contracts: Record<string, { contractId: string }>;
          dependencyGraph: Record<string, string[]>;
        };
      };
    } = {
      networks: {
        testnet: {
          contracts: {
            token: { contractId: existingToken },
            marketplace: { contractId: existingMarket },
          },
          dependencyGraph: { token: [], marketplace: ["token"] },
        },
      },
    };

    readArtifactsMock.mockImplementation(async () => ({
      project: "marketplace-app",
      version: 1 as const,
      networks: store.networks,
    }));

    deployContractMock.mockImplementation(async (opts: { contractName: string }) => {
      const id = opts.contractName === "token" ? "C".padEnd(56, "1") : "C".padEnd(56, "2");
      store.networks.testnet.contracts[opts.contractName] = { contractId: id };
      return { contractId: id, contract: { name: opts.contractName } };
    });

    const result = await deployContractGraph({
      config,
      networkName: "testnet",
      source: "alice",
      cwd: "/tmp/app",
      includeDependencies: true,
      force: true,
    });

    expect(deployContractMock).toHaveBeenCalledTimes(2);
    expect(deployContractMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ contractName: "token", force: true })
    );
    expect(deployContractMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ contractName: "marketplace", force: true })
    );
    expect(result.skippedContracts).toEqual([]);
    expect(result.deployedContracts.map((c) => c.name)).toEqual(["token", "marketplace"]);
  });

  it("should_verify_dependencies_before_resolve_when_verifyDeps_true", async () => {
    const tokenId = "C".padEnd(56, "A");
    readArtifactsMock.mockResolvedValue({
      project: "marketplace-app",
      version: 1,
      networks: {
        testnet: {
          contracts: { token: { contractId: tokenId } },
          dependencyGraph: {},
        },
      },
    });

    deployContractMock.mockImplementation(async (opts: { contractName: string }) => ({
      contractId: opts.contractName === "token" ? tokenId : "C".padEnd(56, "B"),
      contract: { name: opts.contractName },
    }));

    await deployContractGraph({
      config,
      contractName: "marketplace",
      networkName: "testnet",
      source: "alice",
      cwd: "/tmp/app",
      includeDependencies: true,
      force: false,
      verifyDeps: true,
    });

    expect(verifyDependencyContractsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencies: ["token"],
        network: expect.objectContaining({ name: "testnet" }),
      })
    );
  });
});
