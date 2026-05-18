import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseStellarCliVersion } from "./version.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../../test/fixtures/stellar-cli");

async function readFixture(relativePath: string): Promise<string> {
  return readFile(path.join(fixturesDir, relativePath), "utf8");
}

describe("parseStellarCliVersion (checked-in fixtures)", () => {
  it("should_parse_semver_from_v22_0_0_version_fixture", async () => {
    const output = await readFixture("v22.0.0/version.v22.0.0.fixture.txt");
    expect(parseStellarCliVersion(output)).toBe("22.0.0");
  });

  it("should_parse_semver_from_v22_0_1_version_fixture", async () => {
    const output = await readFixture("v22.0.1/version.v22.0.1.fixture.txt");
    expect(parseStellarCliVersion(output)).toBe("22.0.1");
  });

  it("should_parse_semver_from_v24_0_0_version_fixture", async () => {
    const output = await readFixture("v24.0.0/version.v24.0.0.fixture.txt");
    expect(parseStellarCliVersion(output)).toBe("24.0.0");
  });

  it("should_parse_semver_from_v25_2_0_version_fixture", async () => {
    const output = await readFixture("v25.2.0/version.v25.2.0.fixture.txt");
    expect(parseStellarCliVersion(output)).toBe("25.2.0");
  });

  it("should_parse_semver_from_v26_0_0_version_fixture", async () => {
    const output = await readFixture("v26.0.0/version.txt");
    expect(parseStellarCliVersion(output)).toBe("26.0.0");
  });
});
