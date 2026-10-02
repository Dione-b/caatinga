import { StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { assertReadSourceAccount, normalizeReadSourceAccount } from "./read-source.js";

const VALID_SOURCE_ACCOUNT = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(3));

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }

  throw new Error("expected the call to throw");
}

describe("normalizeReadSourceAccount", () => {
  it("should_return_undefined_for_missing_blank_and_whitespace_values", () => {
    expect(normalizeReadSourceAccount(undefined)).toBeUndefined();
    expect(normalizeReadSourceAccount("")).toBeUndefined();
    expect(normalizeReadSourceAccount("   ")).toBeUndefined();
  });

  it("should_trim_a_provided_source_account", () => {
    expect(normalizeReadSourceAccount(` ${VALID_SOURCE_ACCOUNT} `)).toBe(VALID_SOURCE_ACCOUNT);
  });
});

describe("assertReadSourceAccount", () => {
  it("should_accept_a_valid_ed25519_public_key", () => {
    expect(assertReadSourceAccount(VALID_SOURCE_ACCOUNT, "the sourceAccount option")).toBe(
      VALID_SOURCE_ACCOUNT
    );
  });

  it("should_reject_values_that_are_not_ed25519_public_keys", () => {
    const invalidValues = [
      "GPUBLIC",
      "not-an-account",
      VALID_SOURCE_ACCOUNT.toLowerCase(),
      // One character short, and a `0` (not in the StrKey alphabet). Checksum is not
      // checked here: the client validates the `G` + 55 base32 shape without the SDK.
      VALID_SOURCE_ACCOUNT.slice(0, -1),
      `G${"0".repeat(55)}`,
      StrKey.encodeContract(new Uint8Array(32).fill(7)),
      "SABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW",
    ];

    for (const invalidValue of invalidValues) {
      const error = captureError(() =>
        assertReadSourceAccount(invalidValue, 'the sourceAccount option of "counter.get"')
      );

      expect(error).toBeInstanceOf(CaatingaError);
      expect(error).toMatchObject({
        code: CaatingaErrorCode.INVALID_CONFIG,
        message: expect.stringContaining('the sourceAccount option of "counter.get"'),
        hint: expect.stringContaining("Ed25519 public key"),
      });
    }
  });
});
