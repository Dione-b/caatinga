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
});
