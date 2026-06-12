import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork, type ResolvedNetwork } from "../networks/resolve-network.js";
import { generateBindings } from "./generate-bindings.js";

export type GenerateBindingsGraphResult = {
  network: ResolvedNetwork;
  results: Array<Awaited<ReturnType<typeof generateBindings>>>;
};

export async function generateBindingsGraph(options: {
  config: CaatingaConfig;
  contractName?: string;
  contractNames?: string[];
  networkName?: string;
  cwd?: string;
}): Promise<GenerateBindingsGraphResult> {
  const cwd = options.cwd ?? process.cwd();
  const network = resolveNetwork(options.config, options.networkName);

  let targets: string[];
  if (options.contractName) {
    targets = [options.contractName];
  } else if (options.contractNames && options.contractNames.length > 0) {
    targets = options.contractNames;
  } else {
    const artifacts = await readArtifacts(cwd);
    targets = Object.keys(artifacts.networks[network.name]?.contracts ?? {});

    if (targets.length === 0) {
      throw new CaatingaError(
        `No deployed contracts found on "${network.name}".`,
        CaatingaErrorCode.ARTIFACT_NOT_FOUND,
        "Run caatinga deploy before generating bindings, or pass a contract name."
      );
    }
  }

  const results: GenerateBindingsGraphResult["results"] = [];
  for (const contractName of targets) {
    results.push(
      await generateBindings({
        config: options.config,
        contractName,
        networkName: network.name,
        cwd
      })
    );
  }

  return { network, results };
}
