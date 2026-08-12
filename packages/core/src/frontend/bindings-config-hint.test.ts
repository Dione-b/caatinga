import { describe, expect, it } from "vitest";
import { CaatingaConfigSchema } from "../config/config.schema.js";
import {
  DEFAULT_BINDINGS_OUTPUT,
  frontendBindingsConfigHint,
  frontendBindingsConfigSnippet,
} from "./bindings-config-hint.js";

/** Reads the emitted snippet back so the *keys* are asserted, not just the prose. */
function parseSnippet(snippet: string): Record<string, string> {
  const fields = [...snippet.matchAll(/^\s*(\w+): "(.*?)",?$/gm)];
  expect(fields.length, `no fields parsed from:\n${snippet}`).toBeGreaterThan(0);

  return Object.fromEntries(fields.map((field) => [field[1], field[2]]));
}

describe("frontendBindingsConfigSnippet", () => {
  it("should_emit_a_frontend_block_with_bindingsOutput", () => {
    const snippet = frontendBindingsConfigSnippet();

    expect(snippet).toContain("frontend: {");
    expect(parseSnippet(snippet)).toEqual({ bindingsOutput: DEFAULT_BINDINGS_OUTPUT });
  });

  it("should_produce_a_config_that_satisfies_the_real_schema_when_pasted", () => {
    // The whole point of #104: the field name in prose was not enough, users had to read
    // the Zod schema. Validating with that schema is what proves the snippet is usable.
    const parsed = parseSnippet(frontendBindingsConfigSnippet());

    const config = CaatingaConfigSchema.parse({
      project: "app",
      defaultNetwork: "testnet",
      contracts: { app: { path: "./contracts/app", wasm: "./app.wasm" } },
      networks: {
        testnet: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      },
      frontend: parsed,
    });

    expect(config.frontend?.bindingsOutput).toBe(DEFAULT_BINDINGS_OUTPUT);
    // framework has a schema default, which is why the snippet can omit it.
    expect(config.frontend?.framework).toBe("vite-react");
  });

  it("should_honour_a_custom_output_path", () => {
    expect(frontendBindingsConfigSnippet("./app/generated")).toContain(
      'bindingsOutput: "./app/generated"'
    );
  });
});

describe("frontendBindingsConfigHint", () => {
  it("should_name_the_file_to_edit_and_embed_the_snippet", () => {
    const hint = frontendBindingsConfigHint();

    expect(hint).toContain("caatinga.config.ts");
    expect(hint).toContain(frontendBindingsConfigSnippet());
  });

  it("should_not_tell_the_user_to_run_generate", () => {
    // `generate` is what fails without this config; repeating it as the fix is the
    // circular advice #104 reported. Matched as a command, not as a bare substring —
    // the default output path legitimately contains the word "generated".
    expect(frontendBindingsConfigHint()).not.toMatch(/(run|ctg|caatinga)\s+generate/i);
  });
});
