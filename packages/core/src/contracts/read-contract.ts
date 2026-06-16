import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { resolveCliSource } from "./source-account.js";
import { parseInvokeTarget } from "./invoke-target.js";

export {
  buildReadCallHint,
  isReadCallFailure,
  READ_CALL_FAILURE_REGEX
} from "./invoke-target.js";

export type ReadContractOptions = {
  config: CaatingaConfig;
  target: string;
  args?: string[];
  networkName?: string;
  source?: string;
  cwd?: string;
};

export async function readContract(options: ReadContractOptions) {
  const cwd = options.cwd ?? process.cwd();
  const network = resolveNetwork(options.config, options.networkName);
  const target = parseInvokeTarget(options.target);
  const artifacts = await readArtifacts(cwd);
  const contractArtifact = artifacts.networks[network.name]?.contracts[target.contractName];

  if (!contractArtifact) {
    throw new CaatingaError(
      `No deployed artifact found for "${target.contractName}" on "${network.name}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run caatinga deploy for this contract and network before reading it."
    );
  }

  await checkBinary("stellar", "Install Stellar CLI before running caatinga read.");

  const stellarArgs = [
    "contract",
    "invoke",
    "--id",
    contractArtifact.contractId,
    "--source-account",
    resolveCliSource(options.source),
    "--send=no",
    ...buildStellarNetworkArgs(network),
    "--",
    target.method,
    ...(options.args ?? [])
  ];

  const result = await runCommand("stellar", stellarArgs, {
    cwd,
    failureCode: CaatingaErrorCode.INVOKE_FAILED
  });

  return {
    target,
    network,
    result: result.stdout || result.all
  };
}
