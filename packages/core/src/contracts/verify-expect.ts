import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { ExpectMatcherSchema } from "../config/config.schema.js";
import type { ExpectMatcher, ExpectSpec } from "../config/config.schema.js";

export type VerifyExpectResult = {
  ok: true;
  actual: string;
};

export type VerifyExpectFailure = {
  ok: false;
  actual: string;
  expectedDescription: string;
};

export type VerifyExpectOutcome = VerifyExpectResult | VerifyExpectFailure;

// #158: derive the allowed matchers from the canonical Zod enum so the list
// can't drift from the schema and a new matcher only needs adding in one place.
const EXPECT_MATCHERS: ReadonlySet<ExpectMatcher> = new Set(ExpectMatcherSchema.options);

function describeExpectSpec(spec: ExpectSpec): string {
  if (typeof spec === "string") {
    return `"${spec}"`;
  }

  if (spec.value !== undefined) {
    return `${spec.matcher}(${JSON.stringify(spec.value)})`;
  }

  return spec.matcher;
}

function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function evaluateMatcher(actual: string, spec: Exclude<ExpectSpec, string>): VerifyExpectOutcome {
  const matcher = spec.matcher;

  switch (matcher) {
    case "equals": {
      const expected = String(spec.value ?? "").trim();
      if (actual !== expected) {
        return {
          ok: false,
          actual,
          expectedDescription: describeExpectSpec(spec),
        };
      }
      return { ok: true, actual };
    }
    case "reachable": {
      if (actual.length === 0) {
        return {
          ok: false,
          actual,
          expectedDescription: "non-empty reachable output",
        };
      }
      return { ok: true, actual };
    }
    case "isNull": {
      const normalized = actual.toLowerCase();
      if (normalized !== "null" && normalized !== "") {
        return {
          ok: false,
          actual,
          expectedDescription: "null",
        };
      }
      return { ok: true, actual };
    }
    case "isArray": {
      const parsed = tryParseJson(actual);
      if (!Array.isArray(parsed)) {
        return {
          ok: false,
          actual,
          expectedDescription: "JSON array",
        };
      }
      return { ok: true, actual };
    }
    case "minLength": {
      const min = Number(spec.value);
      if (!Number.isFinite(min)) {
        throw new CaatingaError(
          `Expect matcher "minLength" requires a numeric value.`,
          CaatingaErrorCode.INVALID_CONFIG,
          'Use expect: { matcher: "minLength", value: 1 }.'
        );
      }
      const parsed = tryParseJson(actual);
      const length = Array.isArray(parsed) ? parsed.length : actual.length;
      if (length < min) {
        return {
          ok: false,
          actual,
          expectedDescription: `length >= ${min}`,
        };
      }
      return { ok: true, actual };
    }
    case "maxLength": {
      const max = Number(spec.value);
      if (!Number.isFinite(max)) {
        throw new CaatingaError(
          `Expect matcher "maxLength" requires a numeric value.`,
          CaatingaErrorCode.INVALID_CONFIG,
          'Use expect: { matcher: "maxLength", value: 100 }.'
        );
      }
      const parsed = tryParseJson(actual);
      const length = Array.isArray(parsed) ? parsed.length : actual.length;
      if (length > max) {
        return {
          ok: false,
          actual,
          expectedDescription: `length <= ${max}`,
        };
      }
      return { ok: true, actual };
    }
    case "contains": {
      const needle = String(spec.value ?? "");
      if (!actual.includes(needle)) {
        return {
          ok: false,
          actual,
          expectedDescription: `contains ${JSON.stringify(needle)}`,
        };
      }
      return { ok: true, actual };
    }
    case "matches": {
      const pattern = String(spec.value ?? "");
      let regex: RegExp;
      try {
        regex = new RegExp(pattern);
      } catch {
        throw new CaatingaError(
          `Expect matcher "matches" has invalid regex: ${pattern}`,
          CaatingaErrorCode.INVALID_CONFIG,
          'Use expect: { matcher: "matches", value: "^G[A-Z2-7]{55}$" }.'
        );
      }
      if (!regex.test(actual)) {
        return {
          ok: false,
          actual,
          expectedDescription: `matches /${pattern}/`,
        };
      }
      return { ok: true, actual };
    }
    case "jsonEquals": {
      const expectedRaw = String(spec.value ?? "");
      const actualParsed = tryParseJson(actual);
      const expectedParsed = tryParseJson(expectedRaw);
      if (actualParsed === undefined || expectedParsed === undefined) {
        return {
          ok: false,
          actual,
          expectedDescription: `jsonEquals ${expectedRaw}`,
        };
      }
      if (JSON.stringify(actualParsed) !== JSON.stringify(expectedParsed)) {
        return {
          ok: false,
          actual,
          expectedDescription: `jsonEquals ${expectedRaw}`,
        };
      }
      return { ok: true, actual };
    }
    default: {
      const unknownMatcher = matcher as string;
      throw new CaatingaError(
        `Unknown expect matcher "${unknownMatcher}".`,
        CaatingaErrorCode.INVALID_CONFIG,
        `Supported matchers: ${[...EXPECT_MATCHERS].join(", ")}.`
      );
    }
  }
}

export function verifyExpect(actualRaw: string, spec: ExpectSpec): VerifyExpectOutcome {
  const actual = actualRaw.trim();

  if (typeof spec === "string") {
    const expected = spec.trim();
    if (actual !== expected) {
      return {
        ok: false,
        actual,
        expectedDescription: describeExpectSpec(spec),
      };
    }
    return { ok: true, actual };
  }

  return evaluateMatcher(actual, spec);
}

export function assertExpect(actualRaw: string, spec: ExpectSpec, context: string): void {
  const outcome = verifyExpect(actualRaw, spec);
  if (outcome.ok) {
    return;
  }

  throw new CaatingaError(
    `Verification failed for ${context}.`,
    CaatingaErrorCode.POST_DEPLOY_VERIFY_FAILED,
    `Expected ${outcome.expectedDescription} but got "${outcome.actual}".`
  );
}

export function parseExpectSpec(raw: string): ExpectSpec {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null && "matcher" in parsed) {
      return parsed as Exclude<ExpectSpec, string>;
    }
  } catch {
    // fall through to string expect
  }

  return trimmed;
}

export function formatExpectDescription(spec: ExpectSpec): string {
  return describeExpectSpec(spec);
}
