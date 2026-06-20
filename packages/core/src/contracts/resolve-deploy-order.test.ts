import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveDeployOrder } from "./resolve-deploy-order.js";

describe("resolveDeployOrder", () => {
  const contracts = {
    token: { path: "./contracts/token", wasm: "./token.wasm", dependsOn: [], deployArgs: {} },
    marketplace: {
      path: "./contracts/marketplace",
      wasm: "./marketplace.wasm",
      dependsOn: ["token"],
      deployArgs: {},
    },
    rewards: {
      path: "./contracts/rewards",
      wasm: "./rewards.wasm",
      dependsOn: ["marketplace"],
      deployArgs: {},
    },
  };

  it("sorts two contracts in dependency order", () => {
    expect(
      resolveDeployOrder({ contracts, selectedContract: "marketplace", includeDependencies: true })
    ).toEqual(["token", "marketplace"]);
  });

  it("sorts three contracts in dependency order", () => {
    expect(resolveDeployOrder({ contracts, includeDependencies: true })).toEqual([
      "token",
      "marketplace",
      "rewards",
    ]);
  });

  it("fails for unknown dependency", () => {
    expect(() =>
      resolveDeployOrder({
        contracts: {
          marketplace: {
            path: "./contracts/marketplace",
            wasm: "./marketplace.wasm",
            dependsOn: ["token"],
            deployArgs: {},
          },
        },
        includeDependencies: true,
      })
    ).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_NOT_FOUND })
    );
  });

  it("fails for dependency cycles", () => {
    expect(() =>
      resolveDeployOrder({
        contracts: {
          a: { path: "./a", wasm: "./a.wasm", dependsOn: ["b"], deployArgs: {} },
          b: { path: "./b", wasm: "./b.wasm", dependsOn: ["a"], deployArgs: {} },
        },
        includeDependencies: true,
      })
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_CYCLE }));
  });
});
