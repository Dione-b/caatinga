import { runCommand } from "@caatinga/core";

type R1csInfo = {
  constraints?: number;
  publicInputs?: number;
  outputs?: number;
};

// Counters as `snarkjs r1cs info` prints them. Public inputs and outputs are
// reported separately; a circuit's public signals are the two added together.
const CONSTRAINTS_PATTERN = /# of Constraints:\s+(\d+)/;
const PUBLIC_INPUTS_PATTERN = /# of Public Inputs:\s+(\d+)/;
const OUTPUTS_PATTERN = /# of Outputs:\s+(\d+)/;

function readCounter(output: string, pattern: RegExp): number | undefined {
  const match = output.match(pattern);
  return match ? Number.parseInt(match[1]!, 10) : undefined;
}

/**
 * Runs `snarkjs r1cs info` on a compiled circuit. A counter snarkjs did not
 * print is left undefined, so each caller decides whether it can do without it.
 */
export async function readR1csInfo(snarkjs: string, r1csPath: string): Promise<R1csInfo> {
  const { stdout } = await runCommand(snarkjs, ["r1cs", "info", r1csPath]);
  return {
    constraints: readCounter(stdout, CONSTRAINTS_PATTERN),
    publicInputs: readCounter(stdout, PUBLIC_INPUTS_PATTERN),
    outputs: readCounter(stdout, OUTPUTS_PATTERN),
  };
}
