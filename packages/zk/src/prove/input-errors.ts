import { ZkError } from "../errors/ZkError.js";

/**
 * Witness errors snarkjs/circom produce for a malformed `input.json`.
 *
 * The message shapes are matched rather than guessed: `Signal X not found` and
 * the `Not enough` / `Too many values` family all come from
 * `circom_runtime/js/witness_calculator.js` in the snarkjs Caatinga installs,
 * so the patterns below track that implementation directly.
 */
const WITNESS_ERROR_PATTERNS: { pattern: RegExp; hint: (signal: string) => string }[] = [
  {
    pattern: /Signal (\S+) not found/i,
    hint: (signal) =>
      `Signal "${signal}" is not an input signal of this circuit. Supply only the inputs the circuit declares; outputs are derived during proving.`,
  },
  {
    pattern: /Not enough values for input signal (\S+)/i,
    hint: (signal) =>
      `Signal "${signal}" expects more values than input.json provides — either it is an array whose declared size is not met, or it is a derived signal that should not be in input.json at all.`,
  },
  {
    // Covers both an array signal given the wrong number of values and a
    // derived output signal, which has a declared input size of zero and so
    // always counts as "too many".
    pattern: /Too many values for input signal (\S+)/i,
    hint: (signal) =>
      `Signal "${signal}" takes fewer values than input.json provides. If it is a derived output (the multiplier scaffold's \`c\`), remove it from input.json — outputs are computed during proving. If it is an array input, match its declared size.`,
  },
];

const ZK_INPUT_ERROR_CODE = "ZK_INPUT_CONTAINS_PUBLIC_SIGNALS" as const;

/**
 * Collects every place the underlying tool's message can hide.
 *
 * `runCommand` throws a `CaatingaError` whose `message` is just
 * `Command failed: <cmd> <args>` and puts the combined stdout/stderr in `hint`,
 * keeping the original error as `cause`. Matching only `message` finds nothing,
 * so the witness message would never be recognised.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [error.message];
  for (const field of ["hint", "cause"] as const) {
    const value = (error as unknown as Record<string, unknown>)[field];
    if (value instanceof Error) {
      parts.push(describeError(value));
    } else if (typeof value === "string") {
      parts.push(value);
    }
  }

  return parts.join("\n");
}

/**
 * Re-throws a snarkjs witness failure as a `CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS`
 * error with an actionable hint.
 *
 * Without this, a wrong `input.json` surfaces as an opaque subprocess failure:
 * the user reads snarkjs stderr and has to work out which of several possible
 * causes applies. Errors that match none of the known shapes are returned
 * unchanged so the original `CAATINGA_COMMAND_FAILED` path still reports them.
 */
export function toZkInputError(error: unknown, inputPath: string): unknown {
  const combined = describeError(error);

  for (const { pattern, hint } of WITNESS_ERROR_PATTERNS) {
    const match = combined.match(pattern);
    if (match) {
      // Report the one line of snarkjs output that carries the cause, not the
      // stack trace it is wrapped in — the operator needs the signal name, not
      // a JS call stack from the tool's internals.
      const sourceLine = combined
        .split("\n")
        .map((line) => line.trim())
        .find((line) => pattern.test(line));
      const message = stripAnsi(sourceLine ?? match[0]);

      return new ZkError(
        `${message} (while reading ${inputPath})`,
        ZK_INPUT_ERROR_CODE,
        hint(match[1]!)
      );
    }
  }

  return error;
}

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "").trim();
}
