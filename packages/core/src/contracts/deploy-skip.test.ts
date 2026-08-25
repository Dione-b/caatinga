import { describe, expect, it } from "vitest";
import { toSkippedContract } from "./deploy-skip.js";

describe("toSkippedContract", () => {
  it("should_build_already_deployed_skip_record", () => {
    expect(toSkippedContract("token", "C123", "testnet")).toEqual({
      name: "token",
      contractId: "C123",
      network: "testnet",
      reason: "already-deployed",
    });
  });

  // #97: the graph must be able to propagate the specific skip reason.
  it("should_carry_the_unchanged_wasm_reason_when_provided", () => {
    expect(toSkippedContract("token", "C123", "testnet", "unchanged-wasm")).toEqual({
      name: "token",
      contractId: "C123",
      network: "testnet",
      reason: "unchanged-wasm",
    });
  });
});
