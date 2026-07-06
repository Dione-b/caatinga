import { runCommand } from "../shell/run-command.js";
import { CAATINGA_CORE_VERSION } from "../version.js";
import type { ContractMetadata } from "./artifact.schema.js";

export type CollectMetadataInput = {
  networkName: string;
  wasmHash: string;
  cwd?: string;
};

export async function collectDeploymentMetadata(input: CollectMetadataInput): Promise<ContractMetadata> {
  let gitCommit: string | undefined;
  try {
    const gitResult = await runCommand("git", ["rev-parse", "HEAD"], {
      cwd: input.cwd,
      skipStellarVersionCheck: true,
    });
    gitCommit = gitResult.stdout.trim();
  } catch {
    // Ignore git failures (e.g. if git binary is not installed or not in a git repo)
  }

  let rustcVersion: string | undefined;
  try {
    const rustcResult = await runCommand("rustc", ["--version"], {
      cwd: input.cwd,
      skipStellarVersionCheck: true,
    });
    rustcVersion = rustcResult.stdout.trim();
  } catch {
    // Ignore rustc failures (e.g. if rustc is not installed)
  }

  return {
    gitCommit,
    rustcVersion,
    caatingaVersion: CAATINGA_CORE_VERSION,
    network: input.networkName,
    timestamp: new Date().toISOString(),
    checksum: input.wasmHash,
  };
}
