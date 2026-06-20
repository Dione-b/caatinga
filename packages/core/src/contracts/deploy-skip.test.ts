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
});
