import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveCircuitWasmPath } from "./prove-circuit.js";

describe("resolveCircuitWasmPath", () => {
  it("resolves circom snarkjs wasm under main_js/main.wasm", () => {
    const artifactsDir = "/tmp/project/.artifacts/zk/main";
    expect(resolveCircuitWasmPath(artifactsDir)).toBe(
      path.join(artifactsDir, "main_js", "main.wasm")
    );
  });
});
