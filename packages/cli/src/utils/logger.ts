import chalk from "chalk";

export const logger = {
  info(message: string) {
    if (!message) {
      console.log("");
      return;
    }
    console.log(`${chalk.blue("ℹ")} ${message}`);
  },
  success(message: string) {
    console.log(`${chalk.green("✔")} ${chalk.green(message)}`);
  },
  warn(message: string) {
    console.warn(`${chalk.yellow("⚠")} ${chalk.yellow(message)}`);
  },
  error(message: string) {
    console.error(`${chalk.red("✖")} ${chalk.red(message)}`);
  },
  muted(message: string) {
    console.log(`${chalk.gray("›")} ${chalk.gray(message)}`);
  },
};
