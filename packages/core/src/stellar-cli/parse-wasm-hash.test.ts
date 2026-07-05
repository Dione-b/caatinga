import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { parseWasmHash } from "./parse-wasm-hash.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../../test/fixtures/stellar-cli");
const EXPECTED_HASH = "6ddb28e0980f643bb97350f7e3bacb0ff1fe74d846c6d4f2c625e766210fbb5b";

describe("parseWasmHash", () => {
  it("should_parse_hex_hash_from_upload_fixture", async () => {
    const output = await readFile(path.join(fixturesDir, "v27.0.0/upload-success.txt"), "utf8");
    expect(parseWasmHash(output)).toBe(EXPECTED_HASH);
  });

  it("should_normalize_hash_to_lowercase", () => {
    const output = `Wasm hash: ${EXPECTED_HASH.toUpperCase()}`;
    expect(parseWasmHash(output)).toBe(EXPECTED_HASH);
  });

  it("should_throw_when_hash_missing", () => {
    expect(() => parseWasmHash("upload failed")).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.WASM_HASH_NOT_FOUND,
      })
    );
  });
});
