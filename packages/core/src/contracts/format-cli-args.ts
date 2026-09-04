import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { DeployArgValue } from "./resolve-deploy-args.js";

const CLI_ARG_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function throwUnsafeCliArg(message: string, hint: string): never {
  throw new CaatingaError(message, CaatingaErrorCode.INVALID_CONFIG, hint);
}

export function toSnakeCaseFlag(key: string): string {
  return key
    .replace(/([A-Z])/g, "_$1")
    .replace(/^_/, "")
    .toLowerCase();
}

export function formatConstructorCliArgs(resolved: Record<string, DeployArgValue>): string[] {
  return formatNamedCliArgs(resolved);
}

export function formatNamedCliArgs(resolved: Record<string, DeployArgValue>): string[] {
  const entries = Object.entries(resolved);
  if (entries.length === 0) {
    return [];
  }

  const tail: string[] = [];
  for (const [key, value] of entries) {
    if (!CLI_ARG_KEY_PATTERN.test(key)) {
      throwUnsafeCliArg(
        `Invalid contract argument name "${key}".`,
        "Argument names may only contain letters, digits, and underscores, and must not start with a digit."
      );
    }

    const stringValue = String(value);
    if (stringValue.startsWith("-")) {
      throwUnsafeCliArg(
        `Refusing to pass flag-shaped contract argument value for "${key}".`,
        "Contract argument values must not start with '-' because Stellar CLI would parse them as flags."
      );
    }

    tail.push(`--${toSnakeCaseFlag(key)}`, stringValue);
  }
  return tail;
}

export function assertSafeCliArgs(args: readonly string[]): void {
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (!token.startsWith("-")) {
      continue;
    }

    if (!token.startsWith("--")) {
      throwUnsafeCliArg(
        `Refusing to pass short flag-shaped contract argument "${token}".`,
        "Pass contract arguments as --name value pairs."
      );
    }

    const key = token.slice(2);
    if (!CLI_ARG_KEY_PATTERN.test(key)) {
      throwUnsafeCliArg(
        `Invalid contract argument name "${key}".`,
        "Argument names may only contain letters, digits, and underscores, and must not start with a digit."
      );
    }

    const value = args[index + 1];
    if (value === undefined || value.startsWith("-")) {
      throwUnsafeCliArg(
        `Refusing to pass flag-shaped or missing value for contract argument "${key}".`,
        "Pass each contract argument as --name value, with a value that does not start with '-'."
      );
    }

    index += 1;
  }
}
