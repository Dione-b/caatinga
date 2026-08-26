import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { STELLAR_CLI_SIGNING_FAILURE_REGEX } from "../stellar-cli/version.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { buildReadCallHint, isReadCallFailure, parseInvokeTarget } from "./invoke-target.js";
import { resolveCliMethodArgs } from "./resolve-method-args.js";

export type { InvokeTarget } from "./invoke-target.js";
export { parseInvokeTarget } from "./invoke-target.js";

export type InvokeContractOptions = {
  config: CaatingaConfig;
  target: string;
  args?: string[];
  networkName?: string;
  source?: string;
  cwd?: string;
};

export async function invokeContract(options: InvokeContractOptions) {
  const cwd = options.cwd ?? process.cwd();
  const network = resolveNetwork(options.config, options.networkName);
  const target = parseInvokeTarget(options.target);
  const source = assertSafeSourceAccount(options.source);
  const artifacts = await readArtifacts(cwd);
  const contractArtifact = artifacts.networks[network.name]?.contracts[target.contractName];

  if (!contractArtifact) {
    throw new CaatingaError(
      `No deployed artifact found for "${target.contractName}" on "${network.name}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run ctg deploy for this contract and network before invoking it."
    );
  }

  await checkBinary("stellar", "Install Stellar CLI before running ctg invoke.");

  const methodArgs = await resolveCliMethodArgs(options.args ?? [], {
    source,
    cwd,
  });

  let result: Awaited<ReturnType<typeof runCommand>>;

  try {
    result = await runCommand(
      "stellar",
      [
        "contract",
        "invoke",
        "--id",
        contractArtifact.contractId,
        "--source-account",
        source,
        ...buildStellarNetworkArgs(network),
        "--",
        target.method,
        ...methodArgs,
      ],
      {
        cwd,
        failureCode: CaatingaErrorCode.INVOKE_FAILED,
      }
    );
  } catch (error) {
    if (
      error instanceof CaatingaError &&
      error.code === CaatingaErrorCode.INVOKE_FAILED &&
      isReadCallFailure(error)
    ) {
      throw new CaatingaError(
        error.message,
        error.code,
        buildReadCallHint(target, network.name),
        error
      );
    }

    if (
      error instanceof CaatingaError &&
      error.code === CaatingaErrorCode.INVOKE_FAILED &&
      STELLAR_CLI_SIGNING_FAILURE_REGEX.test(`${error.message}\n${error.hint ?? ""}`)
    ) {
      throw new CaatingaError(
        error.message,
        error.code,
        [
          "Stellar CLI could not sign the invoke transaction (xdr value invalid).",
          "Stellar CLI 22.x has a known invoke signing bug; upgrade to 23.0.0 or newer (27.0.0 recommended).",
          "  stellar --version",
          "Then retry with a funded identity, for example:",
          "  stellar keys generate alice --fund --network testnet",
          "  npx ctg invoke counter.increment --network testnet --source alice",
        ].join("\n"),
        error
      );
    }

    throw error;
  }

  return {
    target,
    network,
    result: result.stdout || result.all,
  };
}
