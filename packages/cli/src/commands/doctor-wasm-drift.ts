import { evaluateWasmDrift } from "@caatinga/core";
import { npxCli } from "../utils/cli-name.js";

export type WasmDriftLine = {
  contract: string;
  localWasmHash?: string;
  artifactWasmHash?: string;
  fix?: string;
};

export async function evaluateWasmDriftDiagnostics(options: {
  networkName?: string;
}): Promise<WasmDriftLine[]> {
  const drift = await evaluateWasmDrift({ networkName: options.networkName });

  return drift
    .filter((entry) => entry.drift)
    .map((entry) => ({
      contract: entry.contract,
      localWasmHash: entry.localWasmHash,
      artifactWasmHash: entry.artifactWasmHash,
      fix: `Run: ${npxCli(`deploy ${entry.contract} --if-changed --source <identity>`)}`,
    }));
}
