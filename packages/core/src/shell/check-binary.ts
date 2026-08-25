import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { runCommand } from "./run-command.js";

type CheckBinaryOptions = {
  skipStellarVersionCheck?: boolean;
};

export async function checkBinary(
  binary: string,
  hint: string,
  options: CheckBinaryOptions = {}
): Promise<void> {
  try {
    // For stellar this is only a presence check: the real Stellar command that
    // runs right after triggers checkStellarCliVersion itself, so re-running
    // that cascade here (version parse + three feature probes) is duplicate
    // work. Non-stellar binaries never trigger the cascade, so pass options
    // through unchanged.
    const runOptions =
      binary === "stellar" ? { ...options, skipStellarVersionCheck: true } : options;
    await runCommand(binary, ["--version"], runOptions);
  } catch (error) {
    if (error instanceof CaatingaError) {
      throw error;
    }

    const code =
      binary === "stellar"
        ? CaatingaErrorCode.STELLAR_CLI_NOT_FOUND
        : binary === "rustc"
          ? CaatingaErrorCode.RUST_NOT_FOUND
          : CaatingaErrorCode.COMMAND_FAILED;
    throw new CaatingaError(`${binary} was not found.`, code, hint, error);
  }
}
