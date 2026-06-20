import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAATINGA_CORE_VERSION } from "../version.js";
import {
  defaultCompatibleCoreRange,
  formatTemplateCompatibilityHint,
  formatTemplateCompatibilityMessage,
  getTemplateCompatibilityIssue,
  isCoreVersionCompatible,
} from "./template-manifest.schema.js";

describe("isCoreVersionCompatible", () => {
  it("should_accept_semver_ranges_that_match_core_version", () => {
    expect(isCoreVersionCompatible("^0.1.0", "0.1.0")).toBe(true);
  });

  it("should_reject_semver_ranges_that_do_not_match_core_version", () => {
    expect(isCoreVersionCompatible("^99.0.0", "0.1.0")).toBe(false);
  });

  it("rejects caret 0.1 ranges when core is on 0.2", () => {
    expect(isCoreVersionCompatible("^0.1.0", "0.2.0")).toBe(false);
    expect(isCoreVersionCompatible("^0.2.0", "0.2.0")).toBe(true);
  });

  it("uses the centralized core version by default", () => {
    const corePackageVersion = JSON.parse(
      readFileSync(join(__dirname, "../../package.json"), "utf8")
    ).version as string;

    expect(CAATINGA_CORE_VERSION).toBe(corePackageVersion);
    expect(isCoreVersionCompatible(defaultCompatibleCoreRange())).toBe(true);
  });
});

describe("defaultCompatibleCoreRange", () => {
  it("should_derive_caret_range_from_core_version", () => {
    expect(defaultCompatibleCoreRange("0.2.0")).toBe("^0.2.0");
    expect(defaultCompatibleCoreRange("1.4.2")).toBe("^1.4.2");
  });
});

describe("getTemplateCompatibilityIssue", () => {
  it("should_describe_core_range_mismatch", () => {
    const issue = getTemplateCompatibilityIssue(
      {
        name: "demo",
        version: "0.1.0",
        caatinga: {
          compatibleCore: "^0.1.0",
          templateVersion: 1,
        },
        frontend: {
          framework: "vite-react",
          packageManager: "npm",
        },
        contracts: {
          path: "contracts",
        },
        files: {
          config: "caatinga.config.ts",
          artifacts: "caatinga.artifacts.json",
        },
      },
      "0.2.0"
    );

    expect(issue).toEqual({
      kind: "core-range",
      requiredRange: "^0.1.0",
      runningVersion: "0.2.0",
    });
    expect(formatTemplateCompatibilityMessage(issue!)).toContain("^0.1.0");
    expect(formatTemplateCompatibilityMessage(issue!)).toContain("0.2.0");
    expect(formatTemplateCompatibilityHint(issue!)).toContain("^0.2.0");
  });
});
