import { describe, expect, it } from "vitest";
import { toZkInputError } from "./input-errors.js";

const inputPath = "/repo/circuits/input.json";

function fail(message: string): unknown {
  return Object.assign(new Error(message), { exitCode: 1 });
}

/**
 * The shape `@caatinga/core`'s `runCommand` actually throws: the tool's output
 * lives in `hint`, not `message`. A test that only sets `message` would pass
 * while production never matched — which is exactly the bug this guards.
 */
function failAsRunCommand(snarkjsStderr: string): unknown {
  const inner = fail(snarkjsStderr);
  return Object.assign(
    new Error("Command failed: snarkjs groth16 fullprove in.json w.wasm k.zkey p.json pub.json"),
    {
      code: "CAATINGA_COMMAND_FAILED",
      hint: snarkjsStderr,
      cause: inner,
    }
  );
}

describe("toZkInputError", () => {
  it("should_match_the_witness_message_inside_a_run_command_error", () => {
    // Real snarkjs stderr, including the ANSI colour codes and stack trace the
    // CLI prints, wrapped the way `runCommand` wraps it.
    const stderr = [
      "[ERROR]  snarkjs: Error: Too many values for input signal b",
      "",
      "    at WitnessCalculatorCircom2._doCalculateWitness (main.cjs:500:14)",
      "    at async groth16FullProve$1 (cli.cjs:6122:5)",
    ].join("\n");

    const error = toZkInputError(failAsRunCommand(stderr), inputPath) as Error & {
      code?: string;
      hint?: string;
    };

    expect(error.code).toBe("ZK_INPUT_CONTAINS_PUBLIC_SIGNALS");
    expect(error.hint).toContain(`Signal "b" takes fewer values`);
    expect(error.hint).toContain("derived output");
  });

  it("should_point_at_a_derived_output_when_the_signal_is_not_an_input", () => {
    const error = toZkInputError(fail("Signal c not found"), inputPath) as Error & {
      code?: string;
      hint?: string;
    };

    expect(error.code).toBe("ZK_INPUT_CONTAINS_PUBLIC_SIGNALS");
    expect(error.hint).toContain(`Signal "c" is not an input signal`);
  });

  it("should_explain_a_short_array_signal", () => {
    const error = toZkInputError(fail("Not enough values for input signal values"), inputPath) as {
      hint?: string;
    };

    expect(error.hint).toContain("more values");
  });

  it("should_explain_a_long_array_signal_or_derived_output", () => {
    // The documented multiplier case: `c` is a derived output, and snarkjs
    // reports it as "too many values" because its declared input size is zero.
    const error = toZkInputError(fail("Too many values for input signal c"), inputPath) as {
      hint?: string;
    };

    expect(error.hint).toContain("derived output");
    expect(error.hint).toContain("remove it from input.json");
  });

  it("should_keep_unknown_failures_untouched", () => {
    const original = fail("connection reset by peer");

    expect(toZkInputError(original, inputPath)).toBe(original);
  });

  it("should_preserve_the_input_path_in_the_message", () => {
    const error = toZkInputError(fail("Signal c not found"), inputPath) as Error;

    expect(error.message).toContain(inputPath);
  });
});
