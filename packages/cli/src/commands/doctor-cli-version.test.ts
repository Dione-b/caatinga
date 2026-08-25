import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateCliVersionChannel, reportCliVersionChannel } from "./doctor-cli-version.js";

const CLI_PACKAGE_NAME = "@caatinga/cli";

function npmView(result: { failed: boolean; stdout: string }) {
  return vi.fn().mockResolvedValue(result);
}

describe("reportCliVersionChannel registry lookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should_query_npm_for_the_cli_dist_tags_json", async () => {
    const runNpmView = npmView({ failed: false, stdout: '{"latest":"3.8.0","next":"3.9.1"}' });

    const report = await reportCliVersionChannel({
      runningVersion: "3.9.1",
      env: {},
      runNpmView,
    });

    expect(runNpmView).toHaveBeenCalledWith(
      ["view", CLI_PACKAGE_NAME, "dist-tags", "--json"],
      5000
    );
    expect(report.latestVersion).toBe("3.8.0");
    expect(report.matchingTags).toEqual(["next"]);
  });

  it("should_honor_a_custom_timeout", async () => {
    const runNpmView = npmView({ failed: false, stdout: '{"latest":"3.8.0"}' });

    await reportCliVersionChannel({
      runningVersion: "3.8.0",
      env: {},
      runNpmView,
      timeoutMs: 1234,
    });

    expect(runNpmView).toHaveBeenCalledWith(
      ["view", CLI_PACKAGE_NAME, "dist-tags", "--json"],
      1234
    );
  });

  it("should_skip_the_check_when_CAATINGA_SKIP_UPDATE_CHECK_is_set", async () => {
    const runNpmView = npmView({ failed: false, stdout: '{"latest":"3.8.0"}' });

    const report = await reportCliVersionChannel({
      runningVersion: "3.9.1",
      env: { CAATINGA_SKIP_UPDATE_CHECK: "1" },
      runNpmView,
    });

    expect(runNpmView).not.toHaveBeenCalled();
    expect(report.latestVersion).toBeUndefined();
    expect(report.note).toBeUndefined();
  });

  it("should_stay_silent_when_npm_fails_or_output_is_unparseable", async () => {
    const cases = [
      npmView({ failed: true, stdout: "" }),
      npmView({ failed: false, stdout: "not json" }),
      npmView({ failed: false, stdout: '"3.8.0"' }),
      npmView({ failed: false, stdout: "{}" }),
      vi.fn().mockRejectedValue(new Error("spawn npm ENOENT")),
    ];

    for (const runNpmView of cases) {
      const report = await reportCliVersionChannel({
        runningVersion: "3.9.1",
        env: {},
        runNpmView,
      });
      expect(report.latestVersion).toBeUndefined();
      expect(report.note).toBeUndefined();
    }
  });

  it("should_drop_non_string_dist_tag_entries", async () => {
    const report = await reportCliVersionChannel({
      runningVersion: "3.8.0",
      env: {},
      runNpmView: npmView({ failed: false, stdout: '{"latest":"3.8.0","broken":42}' }),
    });

    expect(report.latestVersion).toBe("3.8.0");
    expect(report.matchingTags).toEqual(["latest"]);
  });

  it("should_print_the_advisory_note_as_a_warning", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const report = await reportCliVersionChannel({
      runningVersion: "3.9.1",
      env: {},
      runNpmView: npmView({ failed: false, stdout: '{"latest":"3.8.0","next":"3.9.1"}' }),
    });

    expect(report.aheadOfLatest).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ahead of the 'latest' npm tag"));
    expect(logSpy).toHaveBeenCalled();
  });

  it("should_print_nothing_when_running_the_latest_version", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const report = await reportCliVersionChannel({
      runningVersion: "3.8.0",
      env: {},
      runNpmView: npmView({ failed: false, stdout: '{"latest":"3.8.0"}' }),
    });

    expect(report.note).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("evaluateCliVersionChannel", () => {
  it("should_flag_a_version_ahead_of_latest_published_under_next", () => {
    // The exact scenario from the issue: running 3.9.1 while latest is 3.8.0.
    const report = evaluateCliVersionChannel({
      runningVersion: "3.9.1",
      distTags: { latest: "3.8.0", next: "3.9.1" },
    });

    expect(report.aheadOfLatest).toBe(true);
    expect(report.behindLatest).toBe(false);
    expect(report.matchingTags).toEqual(["next"]);
    expect(report.note).toBe(
      `Running ${CLI_PACKAGE_NAME} 3.9.1 (published under the 'next' npm tag), which is ahead of the 'latest' npm tag (3.8.0) — this may be a pre-release build.`
    );
  });

  it("should_flag_ahead_versions_without_a_matching_tag_too", () => {
    const report = evaluateCliVersionChannel({
      runningVersion: "3.9.1",
      distTags: { latest: "3.8.0" },
    });

    expect(report.note).toBe(
      `Running ${CLI_PACKAGE_NAME} 3.9.1, which is ahead of the 'latest' npm tag (3.8.0) — this may be a pre-release build.`
    );
  });

  it("should_stay_silent_when_running_the_latest_tagged_version", () => {
    const report = evaluateCliVersionChannel({
      runningVersion: "3.8.0",
      distTags: { latest: "3.8.0", next: "3.9.1" },
    });

    expect(report.aheadOfLatest).toBe(false);
    expect(report.behindLatest).toBe(false);
    expect(report.matchingTags).toEqual(["latest"]);
    expect(report.note).toBeUndefined();
  });

  it("should_note_when_running_behind_the_latest_tag", () => {
    const report = evaluateCliVersionChannel({
      runningVersion: "3.8.0",
      distTags: { latest: "3.9.2" },
    });

    expect(report.behindLatest).toBe(true);
    expect(report.note).toBe(
      `Running ${CLI_PACKAGE_NAME} 3.8.0, but the 'latest' npm tag is 3.9.2 — update with: npm install -g ${CLI_PACKAGE_NAME}@latest`
    );
  });

  it("should_call_an_ahead_prerelease_suffix_a_definite_prerelease", () => {
    const report = evaluateCliVersionChannel({
      runningVersion: "3.9.1-beta.1",
      distTags: { latest: "3.9.0" },
    });

    expect(report.prerelease).toBe(true);
    expect(report.aheadOfLatest).toBe(true);
    expect(report.note).toContain("this is a pre-release build");
  });

  it("should_flag_a_prerelease_that_matches_the_latest_tag", () => {
    const report = evaluateCliVersionChannel({
      runningVersion: "3.9.1-rc.0",
      distTags: { latest: "3.9.1-rc.0" },
    });

    expect(report.prerelease).toBe(true);
    expect(report.note).toBe(
      `Running ${CLI_PACKAGE_NAME} 3.9.1-rc.0 is a pre-release build (it matches the 'latest' npm tag).`
    );
  });

  it("should_flag_a_prerelease_suffix_even_without_registry_data", () => {
    const report = evaluateCliVersionChannel({ runningVersion: "3.9.1-beta.1" });

    expect(report.note).toBe(`Running ${CLI_PACKAGE_NAME} 3.9.1-beta.1 is a pre-release build.`);
  });

  it("should_prefer_the_prerelease_signal_over_the_behind_latest_hint", () => {
    const report = evaluateCliVersionChannel({
      runningVersion: "0.0.0-dev",
      distTags: { latest: "3.8.0" },
    });

    expect(report.aheadOfLatest).toBe(false);
    expect(report.behindLatest).toBe(true);
    expect(report.prerelease).toBe(true);
    expect(report.note).toBe(
      `Running ${CLI_PACKAGE_NAME} 0.0.0-dev is a pre-release build (the 'latest' npm tag is 3.8.0).`
    );
  });

  it("should_stay_silent_without_registry_data_for_stable_versions", () => {
    expect(evaluateCliVersionChannel({ runningVersion: "3.9.1" }).note).toBeUndefined();
    expect(
      evaluateCliVersionChannel({ runningVersion: "3.9.1", distTags: { next: "3.9.2" } }).note
    ).toBeUndefined();
  });

  it("should_not_crash_on_unparseable_versions", () => {
    const report = evaluateCliVersionChannel({
      runningVersion: "dev",
      distTags: { latest: "3.8.0" },
    });

    expect(report.aheadOfLatest).toBe(false);
    expect(report.behindLatest).toBe(false);
    expect(report.prerelease).toBe(false);
    expect(report.note).toBeUndefined();
  });
});
