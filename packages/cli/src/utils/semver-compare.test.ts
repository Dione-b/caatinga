import { describe, expect, it } from "vitest";
import { compareSemverVersions, hasPrereleaseTag } from "./semver-compare.js";

describe("hasPrereleaseTag", () => {
  it("should_detect_prerelease_tags", () => {
    expect(hasPrereleaseTag("3.9.1-beta.1")).toBe(true);
    expect(hasPrereleaseTag("3.9.1-rc.0")).toBe(true);
  });

  it("should_return_false_for_stable_or_invalid_versions", () => {
    expect(hasPrereleaseTag("3.9.1")).toBe(false);
    expect(hasPrereleaseTag("3.9.1+build.7")).toBe(false);
    expect(hasPrereleaseTag("dev")).toBe(false);
    expect(hasPrereleaseTag("")).toBe(false);
  });
});

describe("compareSemverVersions", () => {
  it("should_order_major_minor_patch_numerically", () => {
    expect(compareSemverVersions("3.9.1", "3.8.0")).toBe(1);
    expect(compareSemverVersions("3.8.0", "3.9.1")).toBe(-1);
    expect(compareSemverVersions("3.9.1", "3.9.1")).toBe(0);
    expect(compareSemverVersions("10.0.0", "9.9.9")).toBe(1);
  });

  it("should_rank_prerelease_below_the_matching_stable_release", () => {
    expect(compareSemverVersions("3.9.1-beta.1", "3.9.1")).toBe(-1);
    expect(compareSemverVersions("3.9.1", "3.9.1-beta.1")).toBe(1);
  });

  it("should_follow_the_semver_spec_precedence_chain", () => {
    const chain = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
    ];

    for (let index = 0; index < chain.length - 1; index += 1) {
      const lower = chain[index];
      const higher = chain[index + 1];
      expect(compareSemverVersions(lower, higher)).toBe(-1);
      expect(compareSemverVersions(higher, lower)).toBe(1);
    }
  });

  it("should_ignore_build_metadata_when_comparing", () => {
    expect(compareSemverVersions("3.9.1+build.1", "3.9.1+build.2")).toBe(0);
  });

  it("should_return_undefined_when_either_side_is_invalid", () => {
    expect(compareSemverVersions("dev", "3.9.1")).toBeUndefined();
    expect(compareSemverVersions("3.9.1", "latest")).toBeUndefined();
    expect(compareSemverVersions("3.9", "3.9.1")).toBeUndefined();
    expect(compareSemverVersions("03.9.1", "3.9.1")).toBeUndefined();
  });
});
