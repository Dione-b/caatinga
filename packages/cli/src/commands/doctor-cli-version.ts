import { execa } from "execa";
import { logger } from "../utils/logger.js";
import { compareSemverVersions, hasPrereleaseTag } from "../utils/semver-compare.js";
import { CAATINGA_CLI_VERSION } from "../version.js";

/**
 * Release-channel advisory for the CLI itself.
 *
 * Caatinga publishes pre-releases under the `next` npm dist-tag and promotes stable
 * releases to `latest` (see scripts/pre-publish.sh and scripts/promote-latest.sh).
 * Nothing in `--version` or `doctor` used to surface which channel the installed CLI
 * came from, so users had to run `npm view @caatinga/cli dist-tags` themselves.
 *
 * These helpers compare the running version against the published dist-tags and emit
 * an informational note. The check is best-effort: it never fails a command, silently
 * skips when npm or the registry is unavailable, and honors CAATINGA_SKIP_UPDATE_CHECK=1.
 */

const CLI_PACKAGE_NAME = "@caatinga/cli";
const CLI_DIST_TAGS_TIMEOUT_MS = 5_000;

export type CliDistTags = Record<string, string>;

export type CliVersionChannelReport = {
  runningVersion: string;
  latestVersion: string | undefined;
  /** Dist-tags whose version equals the running version, for example `["next"]`. */
  matchingTags: string[];
  aheadOfLatest: boolean;
  behindLatest: boolean;
  prerelease: boolean;
  /** Informational advisory; undefined when there is nothing worth surfacing. */
  note: string | undefined;
};

function parseCliDistTags(raw: string): CliDistTags | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const tags: CliDistTags = {};
  for (const [tag, version] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof version === "string" && version.length > 0) {
      tags[tag] = version;
    }
  }

  return Object.keys(tags).length > 0 ? tags : undefined;
}

type NpmViewResult = {
  failed: boolean;
  stdout: string;
};

export type ReportCliVersionChannelOptions = {
  runningVersion?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  /** Test seam replacing the `npm view` subprocess. */
  runNpmView?: (args: string[], timeoutMs: number) => Promise<NpmViewResult>;
};

async function fetchCliDistTags(
  options: ReportCliVersionChannelOptions
): Promise<CliDistTags | undefined> {
  const env = options.env ?? process.env;
  if (env.CAATINGA_SKIP_UPDATE_CHECK === "1") {
    return undefined;
  }

  const runNpmView =
    options.runNpmView ??
    (async (args: string[], timeoutMs: number): Promise<NpmViewResult> => {
      const result = await execa("npm", args, { reject: false, timeout: timeoutMs });
      return { failed: result.failed, stdout: result.stdout };
    });

  try {
    const result = await runNpmView(
      ["view", CLI_PACKAGE_NAME, "dist-tags", "--json"],
      options.timeoutMs ?? CLI_DIST_TAGS_TIMEOUT_MS
    );
    if (result.failed) {
      return undefined;
    }
    return parseCliDistTags(result.stdout);
  } catch {
    // npm missing, registry unreachable, or timed out: doctor must never fail for this.
    return undefined;
  }
}

function formatTagList(tags: string[]): string {
  const quoted = tags.map((tag) => `'${tag}'`).join("/");
  return `${quoted} npm ${tags.length === 1 ? "tag" : "tags"}`;
}

function buildCliVersionNote(input: {
  runningVersion: string;
  latestVersion: string | undefined;
  matchingTags: string[];
  aheadOfLatest: boolean;
  behindLatest: boolean;
  prerelease: boolean;
}): string | undefined {
  const { runningVersion, latestVersion, matchingTags, aheadOfLatest, behindLatest, prerelease } =
    input;

  if (aheadOfLatest && latestVersion) {
    const publishedUnder =
      matchingTags.length > 0 ? ` (published under the ${formatTagList(matchingTags)})` : "";
    const certainty = prerelease
      ? "this is a pre-release build"
      : "this may be a pre-release build";
    return `Running ${CLI_PACKAGE_NAME} ${runningVersion}${publishedUnder}, which is ahead of the 'latest' npm tag (${latestVersion}) — ${certainty}.`;
  }

  if (prerelease) {
    // The running version carries a pre-release suffix; that is the dominant
    // signal, ahead of any behind-latest wording (for example 0.0.0-dev source
    // builds should not be told to upgrade).
    if (latestVersion && behindLatest) {
      return `Running ${CLI_PACKAGE_NAME} ${runningVersion} is a pre-release build (the 'latest' npm tag is ${latestVersion}).`;
    }
    if (latestVersion) {
      return `Running ${CLI_PACKAGE_NAME} ${runningVersion} is a pre-release build (it matches the 'latest' npm tag).`;
    }
    return `Running ${CLI_PACKAGE_NAME} ${runningVersion} is a pre-release build.`;
  }

  if (behindLatest && latestVersion) {
    return `Running ${CLI_PACKAGE_NAME} ${runningVersion}, but the 'latest' npm tag is ${latestVersion} — update with: npm install -g ${CLI_PACKAGE_NAME}@latest`;
  }

  return undefined;
}

export function evaluateCliVersionChannel(input: {
  runningVersion: string;
  distTags?: CliDistTags;
}): CliVersionChannelReport {
  const distTags = input.distTags ?? {};
  const latestVersion = distTags["latest"];
  const matchingTags = Object.entries(distTags)
    .filter(([, version]) => version === input.runningVersion)
    .map(([tag]) => tag)
    .sort();

  const comparison = latestVersion
    ? compareSemverVersions(input.runningVersion, latestVersion)
    : undefined;
  const aheadOfLatest = comparison === 1;
  const behindLatest = comparison === -1;
  const prerelease = hasPrereleaseTag(input.runningVersion);

  return {
    runningVersion: input.runningVersion,
    latestVersion,
    matchingTags,
    aheadOfLatest,
    behindLatest,
    prerelease,
    note: buildCliVersionNote({
      runningVersion: input.runningVersion,
      latestVersion,
      matchingTags,
      aheadOfLatest,
      behindLatest,
      prerelease,
    }),
  };
}

/**
 * Prints the release-channel advisory (never a failure, never affects readiness).
 * Returns the evaluated report so callers and tests can inspect it.
 */
export async function reportCliVersionChannel(
  options: ReportCliVersionChannelOptions = {}
): Promise<CliVersionChannelReport> {
  const runningVersion = options.runningVersion ?? CAATINGA_CLI_VERSION;
  const distTags = await fetchCliDistTags(options);
  const report = evaluateCliVersionChannel({ runningVersion, distTags });

  if (report.note) {
    logger.info("");
    logger.warn(report.note);
  }

  return report;
}
