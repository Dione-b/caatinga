import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { validateSourceShape } from "./validate-source-shape.js";

export function assertSafeSourceAccount(source: string | undefined): string {
  if (!source) {
    throw new CaatingaError(
      "A source account or Stellar CLI identity is required.",
      CaatingaErrorCode.SOURCE_ACCOUNT_REQUIRED,
      "Pass a Stellar CLI identity alias, for example: --source alice"
    );
  }

  const unsafeSource = validateSourceShape(source);
  if (unsafeSource) {
    throw unsafeSource;
  }

  return source;
}

/** Identity used when neither --source nor CAATINGA_SOURCE is provided. */
export const DEFAULT_CLI_SOURCE = "alice";

/** Where a resolved CLI source value came from, for honest disclosure to users. */
export type CliSourceOrigin = "explicit" | "env" | "default";

export type ResolvedCliSource = {
  source: string;
  origin: CliSourceOrigin;
};

/**
 * Resolve the CLI source identity and report where the value came from so the
 * CLI can disclose an implicit fallback instead of silently signing/simulating
 * as `alice`.
 */
export function describeCliSource(explicit?: string): ResolvedCliSource {
  if (explicit) {
    return { source: assertSafeSourceAccount(explicit), origin: "explicit" };
  }

  const fromEnv = process.env.CAATINGA_SOURCE;
  if (fromEnv) {
    return { source: assertSafeSourceAccount(fromEnv), origin: "env" };
  }

  return { source: assertSafeSourceAccount(DEFAULT_CLI_SOURCE), origin: "default" };
}

export function resolveCliSource(explicit?: string): string {
  return describeCliSource(explicit).source;
}
