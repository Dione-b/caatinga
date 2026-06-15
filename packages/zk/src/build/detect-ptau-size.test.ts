import { describe, expect, it } from "vitest";
import { ptauSizeForConstraints } from "./detect-ptau-size.js";

describe("ptauSizeForConstraints", () => {
  it("returns at least 8 for tiny circuits", () => {
    expect(ptauSizeForConstraints(1)).toBe(8);
  });

  it("scales with constraint count", () => {
    expect(ptauSizeForConstraints(1000)).toBeGreaterThan(8);
  });
});
