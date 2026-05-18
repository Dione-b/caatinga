#!/usr/bin/env node
import { assertPreflight } from "./utils/preflight.js";
import { createProgram } from "./program.js";

assertPreflight();

const program = createProgram();

void program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
