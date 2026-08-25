import { describe, expect, it } from "vitest";
import * as coreEntry from "../index.js";
import * as browserEntry from "../browser.js";
// Compile-time guard: ContractMetadata must be exported from BOTH entry points.
// tsc fails here if either drops it (#154). Exported so they are not flagged
// as unused.
import type { ContractMetadata as ContractMetadataFromCore } from "../index.js";
import type { ContractMetadata as ContractMetadataFromBrowser } from "../browser.js";

export type _ContractMetadataFromCore = ContractMetadataFromCore;
export type _ContractMetadataFromBrowser = ContractMetadataFromBrowser;

describe("public export surface (#154)", () => {
  it("does not leak internal regexes from the core entry point", () => {
    // These are internal patterns, not a compatibility contract.
    expect("STELLAR_ADDRESS_REGEX" in coreEntry).toBe(false);
    expect("READ_CALL_FAILURE_REGEX" in coreEntry).toBe(false);
  });

  it("keeps the deliberate public helpers", () => {
    // looksLikeStellarAlias is used by the CLI; isReadCallFailure is the public
    // way to test a read-call failure without touching the raw regex.
    expect(typeof coreEntry.looksLikeStellarAlias).toBe("function");
    expect(typeof coreEntry.isReadCallFailure).toBe("function");
  });

  it("does not export assertSorobanSymbol from the browser entry point", () => {
    // It was exported from browser but not core; align the surfaces by dropping
    // the inconsistent (and unused) export.
    expect("assertSorobanSymbol" in browserEntry).toBe(false);
  });
});
