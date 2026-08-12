import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { CAATINGA_CORE_VERSION } from "../version.js";
import {
  assertOfficialTemplateManifest,
  defaultCompatibleCoreRange,
  formatTemplateCompatibilityHint,
  formatTemplateCompatibilityMessage,
  getTemplateCompatibilityIssue,
  isCoreVersionCompatible,
  type TemplateManifest,
} from "./template-manifest.schema.js";

const officialManifest = (
  overrides: Partial<TemplateManifest["caatinga"]> = {}
): TemplateManifest => ({
  name: "demo",
  version: "0.1.0",
  caatinga: {
    compatibleCore: defaultCompatibleCoreRange(),
    templateVersion: 1,
    ...overrides,
  },
  frontend: { framework: "vite-react", packageManager: "npm" },
  contracts: { path: "contracts" },
  files: { config: "caatinga.config.ts", artifacts: "caatinga.artifacts.json" },
});

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

  it("should_throw_INVALID_TEMPLATE_MANIFEST_for_an_unparseable_core_version", () => {
    // A raw Error here was normalized to CAATINGA_UNEXPECTED_ERROR by the CLI,
    // discarding the fact that the manifest was the problem.
    expect(() => defaultCompatibleCoreRange("not-a-version")).toThrowError(
      expect.objectContaining({
        name: "CaatingaError",
        code: CaatingaErrorCode.INVALID_TEMPLATE_MANIFEST,
      })
    );
  });
});

describe("assertOfficialTemplateManifest", () => {
  it("should_accept_a_manifest_pinned_to_the_running_core_range", () => {
    expect(() => assertOfficialTemplateManifest(officialManifest())).not.toThrow();
  });

  it("should_throw_INVALID_TEMPLATE_MANIFEST_when_compatibleCore_is_not_pinned", () => {
    let thrown: unknown;
    try {
      assertOfficialTemplateManifest(officialManifest({ compatibleCore: "^0.0.1" }));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CaatingaError);
    const error = thrown as CaatingaError;
    expect(error.code).toBe(CaatingaErrorCode.INVALID_TEMPLATE_MANIFEST);
    expect(error.message).toContain(defaultCompatibleCoreRange());
    expect(error.hint).toContain(defaultCompatibleCoreRange());
  });

  it("should_throw_TEMPLATE_INCOMPATIBLE_when_the_template_version_is_unsupported", () => {
    let thrown: unknown;
    try {
      assertOfficialTemplateManifest(officialManifest({ templateVersion: 99 }));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CaatingaError);
    const error = thrown as CaatingaError;
    expect(error.code).toBe(CaatingaErrorCode.TEMPLATE_INCOMPATIBLE);
    expect(error.message).toContain("99");
    // The compatibility helpers already produce an actionable hint; it should reach the user.
    expect(error.hint).toBe(
      formatTemplateCompatibilityHint({ kind: "template-version", expected: 1, actual: 99 })
    );
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
