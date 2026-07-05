import { describe, expect, it } from "vitest";
import { createFreshSmokeSymbol, withFreshSmokeArgs } from "./smoke-args.js";

describe("smoke-args", () => {
  it("should_generate_unique_fresh_symbols", () => {
    const first = createFreshSmokeSymbol();
    const second = createFreshSmokeSymbol();
    expect(first).not.toBe(second);
    expect(first.startsWith("smoke_")).toBe(true);
  });

  it("should_merge_fresh_symbol_into_args_when_enabled", () => {
    const args = withFreshSmokeArgs({ owner: "GABC" });
    expect(args.owner).toBe("GABC");
    expect(String(args.symbol)).toMatch(/^smoke_/);
  });
});
