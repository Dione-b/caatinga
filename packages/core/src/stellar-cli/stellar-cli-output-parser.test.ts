import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  parseContractId,
  parseWasmHash,
  parseStellarCliVersion,
} from "./stellar-cli-output-parser.js";

const VALID_CONTRACT_ID = `C${"A".repeat(55)}`;
const VALID_WASM_HASH = "a".repeat(64);
const VALID_VERSION_OUTPUT = "stellar 27.0.0";

describe("stellar-cli-output-parser (unified façade)", () => {
  describe("parseContractId", () => {
    it("should_parse_valid_contract_id", () => {
      expect(parseContractId(`ContractID: ${VALID_CONTRACT_ID}`)).toBe(VALID_CONTRACT_ID);
    });

    it("should_throw_CONTRACT_ID_NOT_FOUND_when_absent", () => {
      expect(() => parseContractId("no id here")).toThrow(
        expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_ID_NOT_FOUND })
      );
    });
  });

  describe("parseWasmHash", () => {
    it("should_parse_valid_wasm_hash", () => {
      expect(parseWasmHash(`Hash: ${VALID_WASM_HASH}`)).toBe(VALID_WASM_HASH);
    });

    it("should_throw_WASM_HASH_NOT_FOUND_when_absent", () => {
      expect(() => parseWasmHash("no hash here")).toThrow(
        expect.objectContaining({ code: CaatingaErrorCode.WASM_HASH_NOT_FOUND })
      );
    });
  });

  describe("parseStellarCliVersion", () => {
    it("should_parse_valid_semver_from_output", () => {
      expect(parseStellarCliVersion(VALID_VERSION_OUTPUT)).toBe("27.0.0");
    });

    it("should_throw_STELLAR_CLI_VERSION_PARSE_FAILED_when_absent", () => {
      expect(() => parseStellarCliVersion("no version here")).toThrow(
        expect.objectContaining({ code: CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED })
      );
    });
  });
});
