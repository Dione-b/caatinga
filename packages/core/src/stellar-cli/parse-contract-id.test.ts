import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { parseContractId } from "./parse-contract-id.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../../test/fixtures/stellar-cli");
const CONTRACT_ID = `C${"A".repeat(55)}`;

async function fixture(relativePath: string): Promise<string> {
  return readFile(path.join(fixturesDir, relativePath), "utf8");
}

describe("parseContractId", () => {
  it("should_parse_contract_id_from_v26_deploy_success_fixture", async () => {
    const output = await fixture("v26.0.0/deploy-success.txt");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_parse_contract_id_from_v22_deploy_success_fixture", async () => {
    const output = await fixture("v22.0.0/deploy-success.txt");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_parse_contract_id_from_v24_deploy_success_fixture", async () => {
    const output = await fixture("v24.0.0/deploy.v24.0.0.success.fixture.txt");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_parse_contract_id_from_v25_2_deploy_success_fixture", async () => {
    const output = await fixture("v25.2.0/deploy.v25.2.0.success.fixture.txt");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_parse_contract_id_from_minimal_unknown_fixture", async () => {
    const output = await fixture("unknown/deploy-success-minimal.txt");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_prefer_labeled_line_over_lookalike_token_in_earlier_diagnostics", () => {
    const decoy = `C${"B".repeat(55)}`;
    const output = [
      `warning: ledger entry ${decoy} is close to expiration`,
      "Contract deployed successfully.",
      `Contract ID: ${CONTRACT_ID}`,
    ].join("\n");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_prefer_standalone_id_line_over_lookalike_token_when_output_is_unlabeled", () => {
    const decoy = `C${"B".repeat(55)}`;
    const output = [`warning: skipping cached entry ${decoy}`, CONTRACT_ID].join("\n");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_use_last_labeled_line_when_output_has_several", () => {
    const superseded = `C${"B".repeat(55)}`;
    const output = [`Contract ID: ${superseded}`, `Contract ID: ${CONTRACT_ID}`].join("\n");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_ignore_tokens_using_characters_outside_the_strkey_base32_alphabet", () => {
    const notAStrkey = `C${"0".repeat(55)}`;
    const output = [`note: ${notAStrkey}`, `Contract ID: ${CONTRACT_ID}`].join("\n");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
    expect(() => parseContractId(`note: ${notAStrkey}`)).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_ID_NOT_FOUND })
    );
  });

  it("should_parse_quoted_and_underscored_label_variants", () => {
    expect(parseContractId(`contract_id = "${CONTRACT_ID}"`)).toBe(CONTRACT_ID);
    expect(parseContractId(`  "${CONTRACT_ID}"  `)).toBe(CONTRACT_ID);
  });

  it("should_still_accept_a_bare_id_when_it_is_the_only_one_in_the_output", () => {
    const output = ["deploying...", `done -> ${CONTRACT_ID} (ledger 1234)`].join("\n");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_accept_a_bare_id_repeated_across_lines", () => {
    const output = [
      `uploading wasm for ${CONTRACT_ID}`,
      `deployed ${CONTRACT_ID} (ledger 1234)`,
    ].join("\n");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_refuse_to_guess_when_a_warning_adds_a_second_bare_id", () => {
    const decoy = `C${"B".repeat(55)}`;
    const output = [
      `deployed ${CONTRACT_ID} (ledger 1234)`,
      `warning: contract ${decoy} is deprecated, migrate to a newer version`,
    ].join("\n");

    expect(() => parseContractId(output)).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_ID_NOT_FOUND })
    );
  });

  it("should_name_the_candidates_when_it_refuses_to_guess", () => {
    const decoy = `C${"B".repeat(55)}`;
    const output = [`deployed ${CONTRACT_ID}`, `see also ${decoy}`].join("\n");

    expect(() => parseContractId(output)).toThrow(
      expect.objectContaining({
        hint: expect.stringContaining(decoy),
      })
    );
  });

  it("should_keep_preferring_a_labeled_line_when_several_bare_ids_are_present", () => {
    const decoy = `C${"B".repeat(55)}`;
    const other = `C${"D".repeat(55)}`;
    const output = [
      `warning: ${decoy} expiring`,
      `note: ${other} cached`,
      `Contract ID: ${CONTRACT_ID}`,
    ].join("\n");

    expect(parseContractId(output)).toBe(CONTRACT_ID);
  });

  it("should_throw_when_output_has_no_contract_id", async () => {
    const output = await fixture("unknown/deploy-success-no-contract-id.txt");

    expect(() => parseContractId(output)).toThrow(
      expect.objectContaining({
        code: CaatingaErrorCode.CONTRACT_ID_NOT_FOUND,
      })
    );
  });

  it("should_throw_when_v25_2_deploy_output_has_no_contract_id", async () => {
    const output = await fixture("v25.2.0/deploy.v25.2.0.no-contract-id.fixture.txt");

    expect(() => parseContractId(output)).toThrow(
      expect.objectContaining({
        code: CaatingaErrorCode.CONTRACT_ID_NOT_FOUND,
      })
    );
  });
});
