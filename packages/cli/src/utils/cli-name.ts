import path from "node:path";

/**
 * Resolves the user-facing CLI binary name from argv[1].
 * `ctg` is the short alias; everything else maps to `caatinga`.
 */
export function resolveCliProgramName(argv1: string | undefined = process.argv[1]): string {
  const candidate = path.basename(argv1 ?? "caatinga").replace(/\.(js|ts|mjs|cjs)$/i, "");
  return candidate === "ctg" ? "ctg" : "caatinga";
}

/** Formats a project-local tip as `npx <invoked-bin> <args>`. */
export function npxCli(args: string): string {
  return `npx ${resolveCliProgramName()} ${args}`;
}
