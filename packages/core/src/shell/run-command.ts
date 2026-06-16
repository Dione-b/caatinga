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
      reject: true
    } satisfies Options);

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      all: result.all ?? ""
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

    const output = typeof error === "object" && error && "all" in error ? String(error.all) : undefined;
    throw new CaatingaError(
      `Command failed: ${command} ${args.join(" ")}`,
      options.failureCode ?? CaatingaErrorCode.COMMAND_FAILED,
      output || "Re-run the command with the underlying tool directly for full diagnostics.",
      error
    );
  }
}
