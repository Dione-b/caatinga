import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

export type InvokeTarget = {
  contractName: string;
  method: string;
};

export const READ_CALL_FAILURE_REGEX = /this is a read call|read-only/i;

export function parseInvokeTarget(target: string): InvokeTarget {
  const [contractName, method, extra] = target.split(".");

  if (!contractName || !method || extra) {
    throw new CaatingaError(
      `Invalid invoke target "${target}".`,
      CaatingaErrorCode.INVOKE_TARGET_INVALID,
      "Use the format contract.method, for example counter.increment."
    );
  }

  return { contractName, method };
}

export function buildReadCallHint(target: InvokeTarget, networkName: string): string {
  return [
    `"${target.contractName}.${target.method}" is a read-only contract method.`,
    "Simulate without signing instead:",
    `  npx caatinga read ${target.contractName}.${target.method} --network ${networkName}`,
    "  (--source is optional; Caatinga resolves CAATINGA_SOURCE or defaults to alice)",
    "In browser code, use:",
    `  client.contract("${target.contractName}").read("${target.method}")`,
    `  client.contract("${target.contractName}").simulate("${target.method}")`,
    "Pass method args as the second argument to read() when the contract method takes parameters.",
    "Only pass Stellar CLI --force when you intentionally need a signed read simulation."
  ].join("\n");
}

export function isReadCallFailure(error: unknown): boolean {
  if (!(error instanceof CaatingaError) || error.code !== CaatingaErrorCode.INVOKE_FAILED) {
    return false;
  }

  return READ_CALL_FAILURE_REGEX.test(`${error.message}\n${error.hint ?? ""}`);
}
