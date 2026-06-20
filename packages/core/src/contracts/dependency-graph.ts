import type { ContractConfig } from "../config/config.schema.js";

export function buildDependencyGraph(
  contracts: Record<string, ContractConfig>
): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const name of Object.keys(contracts)) {
    graph[name] = [...contracts[name].dependsOn];
  }
  return graph;
}
