#!/usr/bin/env node
import { assertPreflight } from "./utils/preflight.js";
import { createProgram } from "./program.js";
import { printError } from "./utils/errors.js";

if (!assertPreflight()) {
  // Node exits with process.exitCode when the event loop drains.
} else {
  const program = createProgram();

  void program.parseAsync(process.argv).catch((error: unknown) => {
    printError(error);
    process.exitCode = 1;
  });
}
