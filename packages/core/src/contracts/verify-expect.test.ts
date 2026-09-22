import { describe, expect, it } from "vitest";
import { assertExpect, parseExpectSpec, verifyExpect } from "./verify-expect.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { ExpectMatcherSchema } from "../config/config.schema.js";
import type { ExpectMatcher } from "../config/config.schema.js";

describe("verifyExpect", () => {
  it("should_pass_string_equals_when_output_matches", () => {
    expect(verifyExpect("hello", "hello")).toEqual({ ok: true, actual: "hello" });
  });

  it("should_fail_string_equals_when_output_differs", () => {
    const result = verifyExpect("[1,2]", "[]");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.expectedDescription).toBe('"[]"');
    }
  });

  it("should_pass_reachable_for_non_empty_output", () => {
    expect(verifyExpect("anything", { matcher: "reachable" })).toEqual({
      ok: true,
      actual: "anything",
    });
  });

  it("should_pass_isNull_for_null_literal", () => {
    expect(verifyExpect("null", { matcher: "isNull" })).toEqual({ ok: true, actual: "null" });
  });

  it("should_pass_isArray_for_json_array", () => {
    expect(verifyExpect('[{"id":1}]', { matcher: "isArray" })).toEqual({
      ok: true,
      actual: '[{"id":1}]',
    });
  });

  it("should_pass_minLength_for_array_payload", () => {
    expect(verifyExpect("[1,2,3]", { matcher: "minLength", value: 2 })).toEqual({
      ok: true,
      actual: "[1,2,3]",
    });
  });

  it("should_pass_contains_substring", () => {
    expect(verifyExpect("GABC123", { matcher: "contains", value: "ABC" })).toEqual({
      ok: true,
      actual: "GABC123",
    });
  });

  it("should_pass_matches_regex", () => {
    expect(verifyExpect("GABC123", { matcher: "matches", value: "^G" })).toEqual({
      ok: true,
      actual: "GABC123",
    });
  });

  it("should_pass_jsonEquals_for_equivalent_json", () => {
    expect(verifyExpect('{"a":1}', { matcher: "jsonEquals", value: '{"a":1}' })).toEqual({
      ok: true,
      actual: '{"a":1}',
    });
  });

  it("should_throw_assertExpect_on_failure", () => {
    expect(() => assertExpect("bad", "good", "counter.read")).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.POST_DEPLOY_VERIFY_FAILED })
    );
  });

  it("should_parse_json_expect_spec", () => {
    expect(parseExpectSpec('{"matcher":"isArray"}')).toEqual({ matcher: "isArray" });
  });

  it("should_keep_plain_string_when_not_json", () => {
    expect(parseExpectSpec("[]")).toBe("[]");
  });

  it("should_throw_for_invalid_regex", () => {
    expect(() => verifyExpect("x", { matcher: "matches", value: "[invalid" })).toThrow(
      CaatingaError
    );
  });
  it("should_handle_every_matcher_declared_by_the_schema", () => {
    for (const matcher of ExpectMatcherSchema.options) {
      expect(() => verifyExpect("1", { matcher, value: 1 })).not.toThrow();
    }
  });

  it("should_list_every_schema_matcher_in_the_unknown_matcher_hint", () => {
    let thrown: unknown;
    try {
      verifyExpect("x", { matcher: "notAMatcher" as ExpectMatcher });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CaatingaError);
    for (const matcher of ExpectMatcherSchema.options) {
      expect((thrown as CaatingaError).hint).toContain(matcher);
    }
  });
});
