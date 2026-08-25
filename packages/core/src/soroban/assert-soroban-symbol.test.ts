import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { assertSorobanSymbol } from "./assert-soroban-symbol.js";

describe("assertSorobanSymbol", () => {
  it("should_accept_valid_symbols", () => {
    expect(() => assertSorobanSymbol("hello_world")).not.toThrow();
  });

  it("should_reject_symbols_with_spaces_or_commas", () => {
    expect(() => assertSorobanSymbol("Hello, World!", "label")).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.INVOKE_FAILED })
    );
  });

  // #92: the Soroban host rejects a leading digit, so we must too.
  it("should_reject_symbols_starting_with_a_digit", () => {
    for (const value of ["1abc", "123", "0"]) {
      expect(() => assertSorobanSymbol(value)).toThrowError(
        expect.objectContaining({ code: CaatingaErrorCode.INVOKE_FAILED })
      );
    }
  });

  it("should_accept_symbols_starting_with_a_letter_or_underscore", () => {
    expect(() => assertSorobanSymbol("_private")).not.toThrow();
    expect(() => assertSorobanSymbol("Abc123")).not.toThrow();
    expect(() => assertSorobanSymbol("a")).not.toThrow();
  });

  it("should_enforce_the_32_character_maximum", () => {
    expect(() => assertSorobanSymbol("a".repeat(32))).not.toThrow();
    expect(() => assertSorobanSymbol("a".repeat(33))).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.INVOKE_FAILED })
    );
  });

  it("should_reject_the_empty_string", () => {
    expect(() => assertSorobanSymbol("")).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.INVOKE_FAILED })
    );
  });
});
