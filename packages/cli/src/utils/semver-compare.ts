/**
 * Minimal semver precedence helpers used by the CLI's own release-channel advisory.
 *
 * The CLI package keeps its runtime dependency surface small, and these checks only
 * need ordering between plain semver versions (with optional pre-release tags), so
 * this is a small spec-conformant implementation instead of a `semver` dependency.
 * Precedence follows https://semver.org/ spec item 11; build metadata is ignored.
 */

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  /** Dot-separated pre-release identifiers; empty for stable releases. */
  prerelease: string[];
};

function parseSemverVersion(input: string): ParsedSemver | undefined {
  const match = SEMVER_PATTERN.exec(input.trim());
  if (!match) return undefined;

  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}

export function hasPrereleaseTag(input: string): boolean {
  const parsed = parseSemverVersion(input);
  return parsed !== undefined && parsed.prerelease.length > 0;
}

function comparePrereleaseIdentifier(a: string, b: string): number {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);

  if (aNumeric && bNumeric) {
    return Math.sign(Number(a) - Number(b));
  }

  // Numeric identifiers always have lower precedence than alphanumeric identifiers.
  if (aNumeric !== bNumeric) {
    return aNumeric ? -1 : 1;
  }

  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function comparePrereleaseIdentifiers(a: string[], b: string[]): number {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index += 1) {
    const result = comparePrereleaseIdentifier(a[index], b[index]);
    if (result !== 0) return result;
  }

  // A larger set of pre-release fields has higher precedence when all preceding
  // identifiers are equal (1.0.0-alpha < 1.0.0-alpha.1).
  return Math.sign(a.length - b.length);
}

/**
 * Compares two semver version strings. Returns -1, 0, or 1, or `undefined`
 * when either input is not a valid semver version.
 */
export function compareSemverVersions(a: string, b: string): number | undefined {
  const parsedA = parseSemverVersion(a);
  const parsedB = parseSemverVersion(b);
  if (!parsedA || !parsedB) return undefined;

  for (const field of ["major", "minor", "patch"] as const) {
    if (parsedA[field] !== parsedB[field]) {
      return parsedA[field] < parsedB[field] ? -1 : 1;
    }
  }

  // A pre-release version has lower precedence than the associated normal version.
  if (parsedA.prerelease.length === 0 && parsedB.prerelease.length > 0) return 1;
  if (parsedA.prerelease.length > 0 && parsedB.prerelease.length === 0) return -1;

  return comparePrereleaseIdentifiers(parsedA.prerelease, parsedB.prerelease);
}
