import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "./CaatingaError.js";
import type { CaatingaErrorCodeValue } from "./CaatingaErrorCode.js";
import { listRepoSourceFiles } from "./list-repo-source-files.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

const INLINE_UNPREFIXED_ERROR_CODE_PATTERN =
  /new\s+CaatingaError\s*\([\s\S]*?,\s*["']([A-Z][A-Z0-9_]+)["']/g;
const DOCUMENTED_TABLE_ROW_PATTERN = /^\|\s*`(CAATINGA_[A-Z0-9_]+)`\s*\|(.+)$/gm;
const REQUIRED_ERROR_DOCS_HEADER_PATTERN =
  /^\|\s*Code\s*\|\s*Meaning\s*\|\s*Common cause\s*\|\s*User action\s*\|\s*CI\/release action\s*\|\s*Versioning note\s*\|/m;
const REQUIRED_VERSIONING_NOTE =
  "Public code; adding a new code is minor, removal/rename/meaning change is major.";

describe("CaatingaErrorCode", () => {
  it("should_expose_only_namespaced_public_error_codes", () => {
    expect(Object.values(CaatingaErrorCode).every((code) => code.startsWith("CAATINGA_"))).toBe(
      true
    );
  });

  it("should_document_every_public_error_code", async () => {
    const docsPath = path.join(repoRoot, "docs/errors.md");
    const docs = await readFile(docsPath, "utf8");
    const missingCodes = Object.values(CaatingaErrorCode).filter(
      (code) => !docs.includes(`\`${code}\``)
    );

    expect(missingCodes).toEqual([]);
  });

  it("should_reference_only_exported_public_error_codes_in_docs", () => {
    const docs = readFileSync(path.join(repoRoot, "docs/errors.md"), "utf8");
    const documentedCodes = [...docs.matchAll(DOCUMENTED_TABLE_ROW_PATTERN)].map(
      (match) => match[1]
    );
    const codeValues = new Set(Object.values(CaatingaErrorCode));

    for (const documentedCode of documentedCodes) {
      expect(codeValues.has(documentedCode as CaatingaErrorCodeValue)).toBe(true);
    }
  });

  it("should_document_public_error_codes_with_required_release_columns", () => {
    const docs = readFileSync(path.join(repoRoot, "docs/errors.md"), "utf8");
    const exportedCodes = Object.values(CaatingaErrorCode);
    const documentedRows = [...docs.matchAll(DOCUMENTED_TABLE_ROW_PATTERN)];
    const documentedRowCodes = documentedRows.map((match) => match[1]);

    expect(docs).toMatch(REQUIRED_ERROR_DOCS_HEADER_PATTERN);
    expect(documentedRowCodes.sort()).toEqual([...exportedCodes].sort());

    for (const [, code, remainingColumns] of documentedRows) {
      const cells = remainingColumns.split("|").map((cell) => cell.trim());
      if (cells.at(-1) === "") {
        cells.pop();
      }

      expect(cells).toHaveLength(5);
      expect(cells.slice(0, 4).every((cell) => cell.length > 0)).toBe(true);
      expect(cells[4]).toBe(REQUIRED_VERSIONING_NOTE);
      expect(exportedCodes).toContain(code);
    }
  });

  it("should_not_construct_public_errors_with_inline_unprefixed_codes", async () => {
    const violations: string[] = [];

    for (const filePath of listRepoSourceFiles(repoRoot)) {
      const content = await readFile(filePath, "utf8");
      for (const match of content.matchAll(INLINE_UNPREFIXED_ERROR_CODE_PATTERN)) {
        if (!match[1].startsWith("CAATINGA_")) {
          violations.push(`${path.relative(repoRoot, filePath)}: ${match[1]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
