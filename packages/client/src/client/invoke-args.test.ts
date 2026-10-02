import { describe, expect, it } from "vitest";
import {
  splitArgsAndOptions,
  splitInvokeArgsAndOptions,
  splitReadArgsAndOptions,
} from "./invoke-args.js";

describe("splitInvokeArgsAndOptions", () => {
  it("should_treat_single_options_object_as_invoke_options", () => {
    const parsed = splitInvokeArgsAndOptions({ debugXdr: true, debugRaw: true });

    expect(parsed).toEqual({
      args: undefined,
      debugXdr: true,
      debugRaw: true,
    });
  });

  it("should_keep_args_when_passed_with_explicit_options", () => {
    const parsed = splitInvokeArgsAndOptions({ count: 1 }, { debugRaw: true });

    expect(parsed).toEqual({
      args: { count: 1 },
      debugXdr: false,
      debugRaw: true,
    });
  });

  it("should_keep_args_when_a_single_object_mixes_args_and_option_keys", () => {
    const parsed = splitInvokeArgsAndOptions({ count: 1, debugRaw: true });

    expect(parsed).toEqual({
      args: { count: 1, debugRaw: true },
      debugXdr: false,
      debugRaw: false,
    });
  });

  it("should_treat_an_empty_object_as_args", () => {
    const parsed = splitInvokeArgsAndOptions({});

    expect(parsed).toEqual({
      args: {},
      debugXdr: false,
      debugRaw: false,
    });
  });
});

describe("splitReadArgsAndOptions", () => {
  it("should_treat_single_options_object_as_read_options", () => {
    const parsed = splitReadArgsAndOptions({ debugRaw: true });

    expect(parsed).toEqual({
      args: undefined,
      debugRaw: true,
      sourceAccount: undefined,
    });
  });

  it("should_extract_sourceAccount_when_passed_in_single_options_object", () => {
    const parsed = splitReadArgsAndOptions({ sourceAccount: "GSOURCE" });

    expect(parsed).toEqual({
      args: undefined,
      debugRaw: false,
      sourceAccount: "GSOURCE",
    });
  });

  it("should_keep_args_when_passed_with_explicit_options", () => {
    const parsed = splitReadArgsAndOptions(
      { key: "test" },
      { debugRaw: true, sourceAccount: "GSOURCE" }
    );

    expect(parsed).toEqual({
      args: { key: "test" },
      debugRaw: true,
      sourceAccount: "GSOURCE",
    });
  });

  it("should_keep_args_when_a_single_object_mixes_args_and_option_keys", () => {
    const parsed = splitReadArgsAndOptions({ sourceAccount: "GSOURCE", amount: 10 });

    expect(parsed).toEqual({
      args: { sourceAccount: "GSOURCE", amount: 10 },
      debugRaw: false,
      sourceAccount: undefined,
    });
  });

  it("should_keep_args_for_an_empty_object", () => {
    const parsed = splitReadArgsAndOptions({});

    expect(parsed).toEqual({
      args: {},
      debugRaw: false,
      sourceAccount: undefined,
    });
  });

  it("should_treat_blank_sourceAccount_as_not_provided", () => {
    expect(splitReadArgsAndOptions({ sourceAccount: "   " })).toEqual({
      args: undefined,
      debugRaw: false,
      sourceAccount: undefined,
    });

    expect(splitReadArgsAndOptions({ key: "test" }, { sourceAccount: "" })).toEqual({
      args: { key: "test" },
      debugRaw: false,
      sourceAccount: undefined,
    });
  });

  it("should_trim_sourceAccount_whitespace", () => {
    expect(splitReadArgsAndOptions({ sourceAccount: " GSOURCE " }).sourceAccount).toBe("GSOURCE");
  });
});

describe("splitArgsAndOptions", () => {
  it("should_default_debugRaw_to_false", () => {
    expect(splitArgsAndOptions({ value: 1 })).toEqual({
      args: { value: 1 },
      debugRaw: false,
    });
  });
});
