import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { runCommand } from "./run-command.js";
import { VERSION_PROBE_TIMEOUT_MS } from "./command-timeouts.js";

type CheckBinaryOptions = {
  skipStellarVersionCheck?: boolean;
};

export async function checkBinary(
  binary: string,
  hint: string,
  options: CheckBinaryOptions = {}
): Promise<void> {
  try {
    await runCommand(binary, ["--version"], {
      timeout: VERSION_PROBE_TIMEOUT_MS,
      ...options,
      ...(binary === "stellar" ? { skipStellarVersionCheck: true } : {}),
    });
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
