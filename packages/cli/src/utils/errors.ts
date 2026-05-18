import chalk from "chalk";
import { toCaatingaError } from "@caatinga/core";

const SEPARATOR = chalk.gray("─".repeat(50));

function printError(error: unknown): void {
  const caatingaError = toCaatingaError(error);

  console.error("");
  console.error(SEPARATOR);
  console.error(chalk.red.bold("  ✖ Error"));
  console.error(SEPARATOR);
  console.error(chalk.red(`  ${caatingaError.message}`));
  console.error("");
  console.error(chalk.gray(`  Code: ${caatingaError.code}`));

  if (caatingaError.hint) {
    console.error("");
    console.error(chalk.yellow(`  Hint: ${caatingaError.hint}`));
  }

  console.error(SEPARATOR);
  console.error("");
}

export async function runCliAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}
