import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateStellarCliCompatibility } from "./compat.js";
import { parseContractId } from "./parse-contract-id.js";
import { parseWasmHash } from "./parse-wasm-hash.js";
import { parseStellarCliVersion } from "./version.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../../test/fixtures/stellar-cli");
const CONTRACT_ID = `C${"A".repeat(55)}`;

type MatrixEntry = {
  version: string;
  status: "blocked" | "supported" | "last-tested" | "untested";
  versionFixture?: string;
  deployFixture?: string;
  uploadFixture?: string;
};

const MATRIX: MatrixEntry[] = [
  {
    version: "22.0.0",
    status: "blocked",
    versionFixture: "v22.0.0/version.v22.0.0.fixture.txt",
    deployFixture: "v22.0.0/deploy-success.txt",
  },
  {
    version: "24.0.0",
    status: "supported",
    versionFixture: "v24.0.0/version.v24.0.0.fixture.txt",
    deployFixture: "v24.0.0/deploy.v24.0.0.success.fixture.txt",
  },
  {
    version: "25.2.0",
    status: "last-tested",
    versionFixture: "v25.2.0/version.v25.2.0.fixture.txt",
    deployFixture: "v25.2.0/deploy.v25.2.0.success.fixture.txt",
  },
  {
    version: "26.0.0",
    status: "supported",
    versionFixture: "v26.0.0/version.txt",
    deployFixture: "v26.0.0/deploy-success.txt",
  },
  {
    version: "27.0.0",
    status: "last-tested",
    versionFixture: "v27.0.0/version.txt",
    deployFixture: "v27.0.0/deploy-success.txt",
    uploadFixture: "v27.0.0/upload-success.txt",
  },
];

async function readFixture(relativePath: string): Promise<string> {
  return readFile(path.join(fixturesDir, relativePath), "utf8");
}

describe("stellar CLI version matrix (fixtures)", () => {
  for (const entry of MATRIX) {
    describe(`v${entry.version}`, () => {
      it("should_parse_version_fixture", async () => {
        if (!entry.versionFixture) {
          return;
        }

        const output = await readFixture(entry.versionFixture);
        expect(parseStellarCliVersion(output)).toBe(entry.version);
      });

      it("should_match_compatibility_status", () => {
        if (entry.status === "blocked") {
          expect(() => evaluateStellarCliCompatibility({ version: entry.version })).toThrow();
          return;
        }

        const report = evaluateStellarCliCompatibility({ version: entry.version });

        if (entry.status === "last-tested" || entry.status === "supported") {
          expect(report.status).toBe("supported");
          expect(report.warnings).toEqual([]);
        }

        if (entry.status === "untested") {
          expect(report.status).toBe("untested");
          expect(report.warnings[0]?.code).toBe("STELLAR_CLI_UNTESTED_VERSION");
        }
      });

      it("should_parse_deploy_contract_id_fixture", async () => {
        if (!entry.deployFixture || entry.status === "blocked") {
          return;
        }

        const output = await readFixture(entry.deployFixture);
        expect(parseContractId(output)).toBe(CONTRACT_ID);
      });

      it("should_parse_upload_wasm_hash_fixture", async () => {
        if (!entry.uploadFixture || entry.status === "blocked") {
          return;
        }

        const output = await readFixture(entry.uploadFixture);
        expect(parseWasmHash(output)).toBe(
          "6ddb28e0980f643bb97350f7e3bacb0ff1fe74d846c6d4f2c625e766210fbb5b"
        );
      });
    });
  }

  it("should_treat_23_0_0_as_supported_floor", () => {
    const report = evaluateStellarCliCompatibility({ version: "23.0.0" });
    expect(report.status).toBe("supported");
  });
});
