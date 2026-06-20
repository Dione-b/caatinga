import chalk from "chalk";
import { NODE_MIN_MAJOR } from "@caatinga/core/runtime/requirements";
import { nodeDiagnostic } from "../diagnostics/node-diagnostic.js";

type PreflightResult = { ok: true } | { ok: false; failures: string[] };

function formatNodePreflightFailure(): string {
  const version = process.versions.node;
  return `Node.js ${version} is below the required minimum v${NODE_MIN_MAJOR}.\n  Install Node.js ${NODE_MIN_MAJOR} or newer: https://nodejs.org/`;
}

export function runPreflight(): PreflightResult {
  const diagnostic = nodeDiagnostic();
  if (diagnostic.ok) return { ok: true };

  return { ok: false, failures: [formatNodePreflightFailure()] };
}

export function assertPreflight(): void {
  const result = runPreflight();
  if (result.ok) return;

  console.error(chalk.red.bold("\n✖ Caatinga preflight check failed\n"));
  for (const failure of result.failures) {
    console.error(chalk.red(`  • ${failure}\n`));
  }
  process.exit(1);
}
