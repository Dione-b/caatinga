import { describe, expect, it } from "vitest";
import { isDependenciesNotInstalledError } from "./is-dependencies-not-installed-error.js";

describe("isDependenciesNotInstalledError", () => {
  it("should_detect_ERR_MODULE_NOT_FOUND_for_caatinga_core", () => {
    expect(
      isDependenciesNotInstalledError({
        code: "ERR_MODULE_NOT_FOUND",
        message: "Cannot find package '@caatinga/core'"
      })
    ).toBe(true);
  });

  it("should_detect_nested_cause", () => {
    expect(
      isDependenciesNotInstalledError({
        message: "Failed to load config",
        cause: {
          code: "ERR_MODULE_NOT_FOUND",
          message: "Cannot find package '@caatinga/core'"
        }
      })
    ).toBe(true);
  });

  it("should_ignore_unrelated_module_errors", () => {
    expect(
      isDependenciesNotInstalledError({
        code: "ERR_MODULE_NOT_FOUND",
        message: "Cannot find package 'react'"
      })
    ).toBe(false);
  });
});
