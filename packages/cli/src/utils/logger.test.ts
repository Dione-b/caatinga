import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger.js";
import chalk from "chalk";

describe("logger", () => {
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log info message with blue info icon", () => {
    logger.info("system ready");
    expect(logSpy).toHaveBeenCalledWith(`${chalk.blue("ℹ")} system ready`);
  });

  it("should log success message with green check icon and text", () => {
    logger.success("operation successful");
    expect(logSpy).toHaveBeenCalledWith(`${chalk.green("✔")} ${chalk.green("operation successful")}`);
  });

  it("should log warning message with yellow warning icon and text", () => {
    logger.warn("low balance");
    expect(warnSpy).toHaveBeenCalledWith(`${chalk.yellow("⚠")} ${chalk.yellow("low balance")}`);
  });

  it("should log error message with red error icon and text", () => {
    logger.error("connection lost");
    expect(errorSpy).toHaveBeenCalledWith(`${chalk.red("✖")} ${chalk.red("connection lost")}`);
  });

  it("should log muted message with gray arrow icon and text", () => {
    logger.muted("skipping check");
    expect(logSpy).toHaveBeenCalledWith(`${chalk.gray("›")} ${chalk.gray("skipping check")}`);
  });
});
