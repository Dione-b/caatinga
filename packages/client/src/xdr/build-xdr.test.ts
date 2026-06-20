import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { buildXdr } from "./build-xdr.js";

const rpcUrl = "https://soroban-testnet.stellar.org";

describe("buildXdr", () => {
  it("should_map_prepare_rejection_to_XDR_PREPARE_FAILED_when_prepare_is_async", async () => {
    await expect(
      buildXdr({
        contractName: "counter",
        method: "increment",
        contractId: "CID",
        rpcUrl,
        transaction: {
          toXDR() {
            return "AAAA_UNSIGNED";
          },
          prepare() {
            return Promise.reject(new Error("simulation failed"));
          },
        },
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_PREPARE_FAILED,
      hint: expect.stringContaining(rpcUrl),
    });
  });

  it("should_rethrow_CaatingaError_from_prepare_without_wrapping", async () => {
    const original = new CaatingaError("prep", CaatingaErrorCode.XDR_SIGN_FAILED);

    await expect(
      buildXdr({
        contractName: "counter",
        method: "increment",
        contractId: "CID",
        rpcUrl,
        transaction: {
          toXDR() {
            return "AAAA_UNSIGNED";
          },
          prepare() {
            return Promise.reject(original);
          },
        },
      })
    ).rejects.toBe(original);
  });
});
