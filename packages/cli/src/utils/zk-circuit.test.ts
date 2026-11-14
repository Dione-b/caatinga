import { describe, expect, it } from "vitest";
import type { CaatingaConfig } from "@caatinga/core";
import { resolveZkCircuit } from "./zk-circuit.js";

function configWith(circuits: Record<string, { path: string }> | undefined): CaatingaConfig {
  return {
    project: "demo",
    defaultNetwork: "testnet",
    contracts: {},
    networks: {},
    zk:
      circuits === undefined
        ? undefined
        : {
            circuits: Object.fromEntries(
              Object.entries(circuits).map(([name, circuit]) => [
                name,
                { ...circuit, protocol: "groth16", curve: "bls12381" },
              ])
            ),
          },
  } as unknown as CaatingaConfig;
}

describe("resolveZkCircuit", () => {
  it("should_default_to_the_first_configured_circuit", () => {
    const target = resolveZkCircuit(
      configWith({ main: { path: "./circuits" }, other: { path: "./other" } })
    );

    expect(target.name).toBe("main");
    expect(target.circuit.path).toBe("./circuits");
    expect(target.artifactsDir).toBe(".artifacts/zk/main");
    expect(target.artifacts.proof).toBe(".artifacts/zk/main/proof.json");
    expect(target.artifacts.verificationKey).toBe(".artifacts/zk/main/verification_key.json");
    expect(target.artifacts.publicSignals).toBe(".artifacts/zk/main/public.json");
  });

  it("should_resolve_a_named_circuit", () => {
    const target = resolveZkCircuit(
      configWith({ main: { path: "./circuits" }, other: { path: "./other" } }),
      "other"
    );

    expect(target.name).toBe("other");
    expect(target.artifactsDir).toBe(".artifacts/zk/other");
  });

  it("should_report_a_config_without_circuits_instead_of_an_undefined_circuit", () => {
    const message = "No ZK circuits configured in caatinga.config.ts";

    expect(() => resolveZkCircuit(configWith(undefined))).toThrow(message);
    expect(() => resolveZkCircuit(configWith({}))).toThrow(message);
  });

  it("should_report_an_unknown_circuit_by_name", () => {
    expect(() => resolveZkCircuit(configWith({ main: { path: "./circuits" } }), "nope")).toThrow(
      'Circuit "nope" not found in caatinga.config.ts'
    );
  });
});
