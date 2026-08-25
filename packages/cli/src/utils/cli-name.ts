import path from "node:path";

/**
 * Canonical, recommended binary name used across scaffolds, docs, and CLI
 * guidance output. `caatinga` remains an alias for readability but `ctg` is
 * the short/preferred form.
 */
export const CANONICAL_CLI_NAME = "ctg";

/**
 * Resolves the user-facing CLI binary name from argv[1] for the help banner.
 * `ctg` maps to itself; everything else maps to `caatinga`.
 */
export function resolveCliProgramName(argv1: string | undefined = process.argv[1]): string {
  const candidate = path.basename(argv1 ?? "caatinga").replace(/\.(js|ts|mjs|cjs)$/i, "");
  return candidate === CANONICAL_CLI_NAME ? CANONICAL_CLI_NAME : "caatinga";
}

/**
 * Formats a project-local tip using the canonical binary name so generated
 * guidance agrees with scaffolds and docs regardless of how the CLI was invoked.
 */
export function npxCli(args: string): string {
  return `npx ${CANONICAL_CLI_NAME} ${args}`;
}
