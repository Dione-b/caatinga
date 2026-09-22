import { describe, expect, it } from "vitest";
import {
  ContractArtifactHistoryEntrySchema,
  ContractArtifactSchema,
} from "./artifact.schema.js";

/** A well-formed contract strkey: `C` + 55 base32 (A-Z2-7) characters. */
const VALID_CONTRACT_ID = `C${"A".repeat(55)}`;
/** A well-formed wasm hash: 64 lowercase hex characters. */
const VALID_WASM_HASH = "a".repeat(64);

function baseArtifact(overrides: Record<string, unknown> = {}) {
  return {
    contractId: VALID_CONTRACT_ID,
    wasmHash: VALID_WASM_HASH,
    deployedAt: "2026-05-12T00:00:00.000Z",
    sourcePath: "./contracts/token",
    wasmPath: "./contracts/token.wasm",
    ...overrides,
  };
}

function baseHistoryEntry(overrides: Record<string, unknown> = {}) {
  return {
    contractId: VALID_CONTRACT_ID,
    wasmHash: VALID_WASM_HASH,
    deployedAt: "2026-05-12T00:00:00.000Z",
    supersededAt: "2026-05-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("ContractArtifactSchema contractId/wasmHash validation", () => {
  it("accepts a well-formed contract strkey and lowercase-hex wasm hash", () => {
    const parsed = ContractArtifactSchema.parse(baseArtifact());
    expect(parsed.contractId).toBe(VALID_CONTRACT_ID);
    expect(parsed.wasmHash).toBe(VALID_WASM_HASH);
  });

  it("accepts a realistic base32 contract strkey", () => {
    const parsed = ContractArtifactSchema.parse(
      baseArtifact({ contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" })
    );
    expect(parsed.contractId).toBe("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM");
  });

  it("rejects a contractId with the wrong prefix (G instead of C)", () => {
    expect(() => ContractArtifactSchema.parse(baseArtifact({ contractId: `G${"A".repeat(55)}` }))).toThrow();
  });

  it("rejects a contractId of the wrong length", () => {
    expect(() => ContractArtifactSchema.parse(baseArtifact({ contractId: `C${"A".repeat(54)}` }))).toThrow();
    expect(() => ContractArtifactSchema.parse(baseArtifact({ contractId: "C123" }))).toThrow();
  });

  it("rejects a lowercase contractId", () => {
    expect(() =>
      ContractArtifactSchema.parse(baseArtifact({ contractId: `C${"a".repeat(55)}` }))
    ).toThrow();
  });

  it("rejects a contractId containing base32-invalid digits 0/1/8/9", () => {
    for (const digit of ["0", "1", "8", "9"]) {
      const bad = `C${digit}${"A".repeat(54)}`;
      expect(() => ContractArtifactSchema.parse(baseArtifact({ contractId: bad }))).toThrow();
    }
  });

  it("rejects an uppercase wasmHash", () => {
    expect(() =>
      ContractArtifactSchema.parse(baseArtifact({ wasmHash: "A".repeat(64) }))
    ).toThrow();
  });

  it("rejects a wasmHash of the wrong length", () => {
    expect(() => ContractArtifactSchema.parse(baseArtifact({ wasmHash: "a".repeat(63) }))).toThrow();
    expect(() => ContractArtifactSchema.parse(baseArtifact({ wasmHash: "abc" }))).toThrow();
  });

  it("rejects a non-hex wasmHash", () => {
    expect(() =>
      ContractArtifactSchema.parse(baseArtifact({ wasmHash: `g${"a".repeat(63)}` }))
    ).toThrow();
  });
});

describe("ContractArtifactHistoryEntrySchema contractId/wasmHash validation", () => {
  it("accepts a well-formed history entry", () => {
    const parsed = ContractArtifactHistoryEntrySchema.parse(baseHistoryEntry());
    expect(parsed.contractId).toBe(VALID_CONTRACT_ID);
    expect(parsed.wasmHash).toBe(VALID_WASM_HASH);
  });

  it("rejects a malformed contractId in the history entry", () => {
    expect(() =>
      ContractArtifactHistoryEntrySchema.parse(baseHistoryEntry({ contractId: "C123" }))
    ).toThrow();
  });

  it("rejects a malformed wasmHash in the history entry", () => {
    expect(() =>
      ContractArtifactHistoryEntrySchema.parse(baseHistoryEntry({ wasmHash: "A".repeat(64) }))
    ).toThrow();
  });
});
