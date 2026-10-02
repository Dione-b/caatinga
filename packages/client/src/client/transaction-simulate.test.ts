import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core/browser";
import {
  normalizeSimulationValue,
  prepareReadTransaction,
  readSimulationResult,
} from "./transaction-simulate.js";

describe("transaction-simulate", () => {
  it("should_unwrap_ok_results_from_stellar_bindings", () => {
    const value = {
      isOk: () => true,
      isErr: () => false,
      unwrap: () => true,
      unwrapErr: () => {
        throw new Error("not err");
      },
    };

    expect(normalizeSimulationValue<boolean>(value, "verifier", "verify_proof")).toBe(true);
  });

  it("should_throw_when_stellar_result_is_err", () => {
    const value = {
      isOk: () => false,
      isErr: () => true,
      unwrap: () => {
        throw new Error("not ok");
      },
      unwrapErr: () => ({ message: "MalformedVerifyingKey" }),
    };

    expect(() => normalizeSimulationValue(value, "verifier", "verify_proof")).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.XDR_RESULT_FAILED,
        message: expect.stringContaining("MalformedVerifyingKey"),
      })
    );
  });

  it("should_read_simulation_result_from_assembled_transaction", () => {
    const raw = {
      result: {
        isOk: () => true,
        isErr: () => false,
        unwrap: () => false,
        unwrapErr: () => {
          throw new Error("not err");
        },
      },
    };

    expect(readSimulationResult<boolean>(raw, "verifier", "verify_proof")).toBe(false);
  });

  it("should_classify_account_not_found_during_preparation", async () => {
    await expect(
      prepareReadTransaction(
        { prepare: () => Promise.reject(new Error("ACCOUNT_NOT_FOUND")) },
        "verifier",
        "verify_proof",
        "https://rpc.example"
      )
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND,
      hint: expect.stringContaining("Fund this Stellar account"),
    });
  });

  it("should_classify_resource_limit_during_preparation", async () => {
    await expect(
      prepareReadTransaction(
        { prepare: () => Promise.reject(new Error("HostError(Budget, LimitExceeded)")) },
        "verifier",
        "verify_proof",
        "https://rpc.example"
      )
    ).rejects.toMatchObject({ code: CaatingaErrorCode.SIMULATION_RESOURCE_LIMIT });
  });

  it("should_classify_archived_entry_with_restore_preamble", async () => {
    await expect(
      prepareReadTransaction(
        {
          prepare: () =>
            Promise.reject({
              error: "Simulation requires restoration",
              restorePreamble: { minResourceFee: "100" },
            }),
        },
        "verifier",
        "verify_proof",
        "https://rpc.example"
      )
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.SIMULATION_ENTRY_ARCHIVED,
      hint: expect.stringContaining("restore: true"),
      cause: expect.objectContaining({
        restorePreamble: expect.objectContaining({ minResourceFee: "100" }),
      }),
    });
  });
});
