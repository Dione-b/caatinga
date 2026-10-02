import { StrKey } from "@stellar/stellar-sdk";
import { NULL_ACCOUNT } from "@stellar/stellar-sdk/contract";
import { describe, expect, it } from "vitest";
import { DEFAULT_READ_SOURCE_ACCOUNT } from "./constants.js";

describe("DEFAULT_READ_SOURCE_ACCOUNT", () => {
  it("should_be_a_valid_ed25519_public_key_strkey", () => {
    expect(StrKey.isValidEd25519PublicKey(DEFAULT_READ_SOURCE_ACCOUNT)).toBe(true);
  });

  it("should_match_the_stellar_sdk_null_account", () => {
    // Wallet-less reads rely on the SDK recognizing this value as its null account, so it
    // must stay byte-identical to `@stellar/stellar-sdk`'s NULL_ACCOUNT.
    expect(DEFAULT_READ_SOURCE_ACCOUNT).toBe(NULL_ACCOUNT);
  });
});
