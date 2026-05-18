import chalk from "chalk";

const NODE_MIN_MAJOR = 20;

type PreflightResult =
  | { ok: true }
  | { ok: false; failures: string[] };

function checkNodeVersion(): string | null {
  const major = parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (major < NODE_MIN_MAJOR) {
    return `Node.js ${process.versions.node} is below the required minimum v${NODE_MIN_MAJOR}.\n  Install Node.js ${NODE_MIN_MAJOR} or newer: https://nodejs.org/`;
  }
  return null;
}

export function runPreflight(): PreflightResult {
  const failures: string[] = [];

  const nodeFailure = checkNodeVersion();
  if (nodeFailure) failures.push(nodeFailure);

  if (failures.length > 0) return { ok: false, failures };
  return { ok: true };
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
