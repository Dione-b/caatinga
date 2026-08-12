/**
 * Guidance for the one config field `ctg generate` cannot run without.
 *
 * Naming the field in prose was not enough: users had to read the Zod schema to learn its
 * shape. Every place that reports the missing config shares this snippet so the wording
 * cannot drift, and a test parses it with the real config schema to prove it is copy-pasteable.
 */

/** Suggested output path — inside `src` so bundlers pick the generated client up. */
export const DEFAULT_BINDINGS_OUTPUT = "./src/contracts/generated";

/** The snippet on its own, without surrounding prose, for embedding elsewhere. */
export function frontendBindingsConfigSnippet(
  bindingsOutput: string = DEFAULT_BINDINGS_OUTPUT
): string {
  return `  frontend: {\n    bindingsOutput: ${JSON.stringify(bindingsOutput)}\n  }`;
}

/** Full hint: what to add, where, and the snippet to paste. */
export function frontendBindingsConfigHint(
  bindingsOutput: string = DEFAULT_BINDINGS_OUTPUT
): string {
  return [
    "Add a frontend section to caatinga.config.ts:",
    "",
    frontendBindingsConfigSnippet(bindingsOutput),
    "",
    "Bindings are written to that directory, one subdirectory per contract.",
  ].join("\n");
}
