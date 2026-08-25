import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { parseStellarCliVersion } from "./version.js";

describe("parseStellarCliVersion", () => {
  it("should_parse_valid_semver_from_output", () => {
    expect(parseStellarCliVersion("stellar 27.0.0")).toBe("27.0.0");
  });

  it("should_throw_STELLAR_CLI_VERSION_PARSE_FAILED_when_absent", () => {
    expect(() => parseStellarCliVersion("no version here")).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED })
    );
  });
});
