import { execa, type Options } from "execa";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { CaatingaErrorCodeValue } from "../errors/CaatingaErrorCode.js";
import { checkStellarCliVersion } from "../stellar-cli/check-stellar-cli-version.js";
import { resolveSubprocessEnv } from "./resolve-subprocess-env.js";

export type RunCommandResult = {
  stdout: string;
  stderr: string;
  all: string;
};

type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  skipStellarVersionCheck?: boolean;
  failureCode?: CaatingaErrorCodeValue;
  /**
   * Kill the subprocess after this many milliseconds and surface a
   * {@link CaatingaErrorCode.COMMAND_TIMEOUT}. Omitted means no timeout — see
   * `command-timeouts.ts` for which call sites are bounded and why (#145).
   */
  timeout?: number;
};

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<RunCommandResult> {
  try {
    if (command === "stellar" && !options.skipStellarVersionCheck) {
      await checkStellarCliVersion();
    }

    const result = await execa(command, args, {
      cwd: options.cwd,
      env: resolveSubprocessEnv(options.env ?? {}),
      input: options.input,
      all: true,
      reject: true,
      timeout: options.timeout,
    } satisfies Options);

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      all: result.all ?? "",
    };
  } catch (error) {
    if (error instanceof CaatingaError) {
      throw error;
    }

    if (
      command === "stellar" &&
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new CaatingaError(
        "Stellar CLI was not found.",
        CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
        "Install Stellar CLI before running Caatinga-backed commands.",
        error
      );
    }

    // execa flags a killed-by-timeout run with `timedOut`. Surface a dedicated,
    // actionable error instead of a generic command failure (#145).
    if (typeof error === "object" && error && "timedOut" in error && error.timedOut === true) {
      const seconds = options.timeout ? Math.round(options.timeout / 1000) : undefined;
      throw new CaatingaError(
        `Command timed out: ${command} ${args.join(" ")}`,
        CaatingaErrorCode.COMMAND_TIMEOUT,
        seconds
          ? `The command exceeded ${seconds}s and was killed. Check network and registry availability, then retry.`
          : "The command exceeded its time limit and was killed. Check network and registry availability, then retry.",
        error
      );
    }

    const output =
      typeof error === "object" && error && "all" in error ? String(error.all) : undefined;
    throw new CaatingaError(
      `Command failed: ${command} ${args.join(" ")}`,
      options.failureCode ?? CaatingaErrorCode.COMMAND_FAILED,
      output || "Re-run the command with the underlying tool directly for full diagnostics.",
      error
    );
  }
}
