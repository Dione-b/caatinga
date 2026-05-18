import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { assertSafeSourceAccount } from "./source-account.js";

describe("assertSafeSourceAccount", () => {
  it("should_throw_SOURCE_IS_PUBLIC_KEY_when_G_address", () => {
    expect(() =>
      assertSafeSourceAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")
    ).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_PUBLIC_KEY })
    );
  });

  it("should_throw_SOURCE_IS_SECRET_KEY_when_S_address", () => {
    expect(() =>
      assertSafeSourceAccount("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    ).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_SECRET_KEY })
    );
  });

  it("should_throw_SOURCE_IS_SEED_PHRASE_when_input_has_spaces", () => {
    expect(() => assertSafeSourceAccount("my seed phrase")).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_SEED_PHRASE })
    );
  });

  it("should_throw_UNSAFE_SOURCE_ACCOUNT_when_malformed_g_address", () => {
    expect(() => assertSafeSourceAccount("GSHORT")).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.UNSAFE_SOURCE_ACCOUNT })
    );
  });

  it("should_return_alias_when_non_secret_shape", () => {
    expect(assertSafeSourceAccount("alice")).toBe("alice");
  });

  it("should_throw_CAATINGA_SOURCE_ACCOUNT_REQUIRED_when_undefined", () => {
    try {
      assertSafeSourceAccount(undefined);
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      expect((error as CaatingaError).code).toBe(CaatingaErrorCode.SOURCE_ACCOUNT_REQUIRED);
    }
  });
});
