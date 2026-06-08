import { describe, expect, it } from "vitest";
import {
  splitArgsAndOptions,
  splitInvokeArgsAndOptions,
  splitReadArgsAndOptions
} from "./invoke-args.js";

describe("splitInvokeArgsAndOptions", () => {
  it("should_treat_single_options_object_as_invoke_options", () => {
    const parsed = splitInvokeArgsAndOptions({ debugXdr: true, debugRaw: true });

    expect(parsed).toEqual({
      args: undefined,
      debugXdr: true,
      debugRaw: true
    });
  });

  it("should_keep_args_when_passed_with_explicit_options", () => {
    const parsed = splitInvokeArgsAndOptions({ count: 1 }, { debugRaw: true });

    expect(parsed).toEqual({
      args: { count: 1 },
      debugXdr: false,
      debugRaw: true
    });
  });
});

describe("splitReadArgsAndOptions", () => {
  it("should_treat_single_options_object_as_read_options", () => {
    const parsed = splitReadArgsAndOptions({ debugRaw: true });

    expect(parsed).toEqual({
      args: undefined,
      debugRaw: true
    });
  });
});

describe("splitArgsAndOptions", () => {
  it("should_default_debugRaw_to_false", () => {
    expect(splitArgsAndOptions({ value: 1 })).toEqual({
      args: { value: 1 },
      debugRaw: false
    });
  });
});
