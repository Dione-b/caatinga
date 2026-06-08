import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { validateSourceShape } from "./validate-source-shape.js";

describe("validateSourceShape", () => {
  it("should_reject_secret_key_starting_with_S", () => {
    const error = validateSourceShape("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

    expect(error).toBeDefined();
    expect(error?.code).toBe(CaatingaErrorCode.SOURCE_IS_SECRET_KEY);
  });

  it("should_reject_seed_phrase_with_spaces", () => {
    const error = validateSourceShape("my seed phrase");

    expect(error).toBeDefined();
    expect(error?.code).toBe(CaatingaErrorCode.SOURCE_IS_SEED_PHRASE);
  });

  it("should_reject_valid_public_key_G_address", () => {
    const error = validateSourceShape("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");

    expect(error).toBeDefined();
    expect(error?.code).toBe(CaatingaErrorCode.SOURCE_IS_PUBLIC_KEY);
  });

  it("should_accept_identity_alias", () => {
    expect(validateSourceShape("alice")).toBeUndefined();
  });

  it("should_reject_malformed_G_address", () => {
    const error = validateSourceShape("GSHORT");

    expect(error).toBeDefined();
    expect(error?.code).toBe(CaatingaErrorCode.UNSAFE_SOURCE_ACCOUNT);
  });
});
