import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { formatNamedCliArgs } from "./format-cli-args.js";
import { parseInvokeTarget } from "./invoke-target.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";
import { resolveCliMethodArgs, resolveMethodArgs } from "./resolve-method-args.js";
import { resolveCliSource } from "./source-account.js";

export { buildReadCallHint, isReadCallFailure, READ_CALL_FAILURE_REGEX } from "./invoke-target.js";

export type ReadContractOptions = {
  config: CaatingaConfig;
  target: string;
  args?: string[];
  networkName?: string;
  source?: string;
  cwd?: string;
  /** Resolve record-style args through deploy placeholder + alias resolution. */
  namedArgs?: Record<string, string | number | boolean>;
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
      "Run ctg deploy for this contract and network before reading it."
    );
  }

  await checkBinary("stellar", "Install Stellar CLI before running ctg read.");

  const source = resolveCliSource(options.source);
  let cliArgs = await resolveCliMethodArgs(options.args ?? [], {
    source,
    cwd,
  });

  if (options.namedArgs) {
    const resolved = await resolveDeployArgs({
      deployArgs: options.namedArgs,
      artifacts,
      network: network.name,
      source,
      cwd,
    });
    const methodArgs = await resolveMethodArgs({ args: resolved, source, cwd });
    cliArgs = formatNamedCliArgs(methodArgs);
  }

  const stellarArgs = [
    "contract",
    "invoke",
    "--id",
    contractArtifact.contractId,
    "--source-account",
    source,
    "--send=no",
    ...buildStellarNetworkArgs(network),
    "--",
    target.method,
    ...cliArgs,
  ];

  const result = await runCommand("stellar", stellarArgs, {
    cwd,
    failureCode: CaatingaErrorCode.INVOKE_FAILED,
  });

  return {
    target,
    network,
    result: result.stdout || result.all,
  };
}
