import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { parseContractId } from "./parse-contract-id.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../../test/fixtures/stellar-cli");

async function fixture(relativePath: string): Promise<string> {
  return readFile(path.join(fixturesDir, relativePath), "utf8");
}

describe("deploy failure fixtures", () => {
  it("should_not_parse_contract_id_from_v26_deploy_failure_fixture", async () => {
    const output = await fixture("v26.0.0/deploy-failure.txt");

    expect(() => parseContractId(output)).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_ID_NOT_FOUND })
    );
  });

  it("should_document_simulation_failure_text_in_fixture", async () => {
    const output = await fixture("v26.0.0/deploy-failure.txt");

    expect(output).toMatch(/simulation failed/i);
  });
});
