import { describe, expect, it } from "vitest";
import { STELLAR_ADDRESS_REGEX, isLikelyPublicKeySource } from "./strkey.js";

describe("strkey", () => {
  const validKey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

  it("should_match_a_valid_public_key", () => {
    expect(STELLAR_ADDRESS_REGEX.test(validKey)).toBe(true);
    expect(isLikelyPublicKeySource(validKey)).toBe(true);
  });

  it("should_reject_named_aliases_and_malformed_keys", () => {
    expect(isLikelyPublicKeySource("alice")).toBe(false);
    expect(isLikelyPublicKeySource(validKey.slice(0, -1))).toBe(false); // too short
    expect(isLikelyPublicKeySource(`${validKey}A`)).toBe(false); // too long
    expect(isLikelyPublicKeySource(validKey.replace("G", "M"))).toBe(false); // wrong version byte
    expect(isLikelyPublicKeySource(validKey.replace(/.$/, "1"))).toBe(false); // 1 not in base32 alphabet
  });
});
