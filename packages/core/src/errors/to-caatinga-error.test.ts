import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "./CaatingaErrorCode.js";
import { toCaatingaError } from "./CaatingaError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkSrcDir = path.resolve(__dirname, "../../../zk/src");

function listZkSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      files.push(...listZkSourceFiles(entryPath));
      continue;
    }

    if (stat.isFile() && entryPath.endsWith(".ts") && !entryPath.endsWith(".test.ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

describe("toCaatingaError", () => {
  it("should_normalize_Error_instances_to_UNEXPECTED_ERROR", () => {
    expect(toCaatingaError(new Error("boom")).code).toBe(CaatingaErrorCode.UNEXPECTED_ERROR);
  });

  it("should_preserve_hint_on_unmapped_error_codes", () => {
    const unmapped = Object.assign(new Error("custom zk failure"), {
      code: "ZK_FUTURE_UNMAPPED_CODE",
      hint: "Actionable guidance for the operator.",
    });
    const result = toCaatingaError(unmapped);
    expect(result.code).toBe(CaatingaErrorCode.UNEXPECTED_ERROR);
    expect(result.hint).toBe("Actionable guidance for the operator.");
  });

  it("should_map_ZkError_ZK_DEV_CEREMONY_BLOCKED", () => {
    const zkError = Object.assign(new Error("blocked on mainnet"), {
      code: "ZK_DEV_CEREMONY_BLOCKED",
      hint: "Use testnet.",
    });
    const result = toCaatingaError(zkError);
    expect(result.code).toBe(CaatingaErrorCode.ZK_DEV_CEREMONY_BLOCKED);
  });

  it("should_map_ZkError_ZK_CHECKSUM_MISMATCH_and_preserve_hint", () => {
    const zkError = Object.assign(new Error("Checksum mismatch for circom"), {
      code: "ZK_CHECKSUM_MISMATCH",
      hint: "Do not retry blindly — treat as a possible supply-chain compromise.",
    });
    const result = toCaatingaError(zkError);
    expect(result.code).toBe(CaatingaErrorCode.ZK_CHECKSUM_MISMATCH);
    expect(result.hint).toBe("Do not retry blindly — treat as a possible supply-chain compromise.");
  });

  it("should_map_ZkError_ZK_VERIFY_FAILED_to_ZK_VERIFICATION_FAILED", () => {
    const zkError = Object.assign(new Error("Verifier returned false."), {
      code: "ZK_VERIFY_FAILED",
      hint: "Check your proof inputs.",
    });
    const result = toCaatingaError(zkError);
    expect(result.code).toBe(CaatingaErrorCode.ZK_VERIFICATION_FAILED);
    expect(result.message).toBe("Verifier returned false.");
    expect(result.hint).toBe("Check your proof inputs.");
  });

  it.each([
    ["ZK_VK_REQUIRED", CaatingaErrorCode.ZK_VK_REQUIRED],
    ["ZK_INVOKE_FAILED", CaatingaErrorCode.ZK_INVOKE_FAILED],
    ["ZK_DOWNLOAD_FAILED", CaatingaErrorCode.ZK_DOWNLOAD_FAILED],
    ["ZK_UNSUPPORTED_PLATFORM", CaatingaErrorCode.ZK_UNSUPPORTED_PLATFORM],
    ["ZK_INPUT_CONTAINS_PUBLIC_SIGNALS", CaatingaErrorCode.ZK_INPUT_CONTAINS_PUBLIC_SIGNALS],
    ["ZK_CEREMONY_INCOMPATIBLE", CaatingaErrorCode.ZK_CEREMONY_INCOMPATIBLE],
    ["ZK_CEREMONY_TAMPERED", CaatingaErrorCode.ZK_CEREMONY_TAMPERED],
    ["ZK_CHECKSUM_MISMATCH", CaatingaErrorCode.ZK_CHECKSUM_MISMATCH],
  ])("should_map_ZkError_%s", (sourceCode, expectedCode) => {
    const result = toCaatingaError(Object.assign(new Error("zk failure"), { code: sourceCode }));

    expect(result.code).toBe(expectedCode);
  });

  it("should_map_every_ZkError_code_used_in_packages_zk", () => {
    const zkCodePattern = /["'](ZK_[A-Z0-9_]+)["']/g;
    const discoveredCodes = new Set<string>();

    for (const filePath of listZkSourceFiles(zkSrcDir)) {
      const source = readFileSync(filePath, "utf8");
      for (const match of source.matchAll(zkCodePattern)) {
        if (match[1]) {
          discoveredCodes.add(match[1]);
        }
      }
    }

    expect(discoveredCodes.size).toBeGreaterThan(0);

    for (const code of discoveredCodes) {
      const mapped = toCaatingaError(Object.assign(new Error("zk failure"), { code }));
      expect(
        mapped.code,
        `ZkError code ${code} in packages/zk is not mapped in ZK_ERROR_CODE_MAP`
      ).not.toBe(CaatingaErrorCode.UNEXPECTED_ERROR);
    }
  });
});
