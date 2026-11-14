import type { CaatingaConfig } from "@caatinga/core";
import { zkArtifactPaths, zkArtifactsDir, type ZkArtifactPaths } from "@caatinga/zk";

type ZkCircuitConfig = NonNullable<CaatingaConfig["zk"]>["circuits"][string];

type ZkCircuitTarget = {
  name: string;
  circuit: ZkCircuitConfig;
  /** Artifacts directory of the circuit, relative to the project root. */
  artifactsDir: string;
  artifacts: ZkArtifactPaths;
};

/**
 * Resolves the circuit a `ctg zk` command acts on: the named one, or the first
 * configured circuit when no name is given.
 */
export function resolveZkCircuit(config: CaatingaConfig, circuitName?: string): ZkCircuitTarget {
  const circuits = config.zk?.circuits ?? {};
  const name = circuitName ?? Object.keys(circuits)[0];
  if (name === undefined) {
    throw new Error("No ZK circuits configured in caatinga.config.ts");
  }

  const circuit = circuits[name];
  if (!circuit) {
    throw new Error(`Circuit "${name}" not found in caatinga.config.ts`);
  }

  const artifactsDir = zkArtifactsDir(name);
  return { name, circuit, artifactsDir, artifacts: zkArtifactPaths(artifactsDir) };
}
