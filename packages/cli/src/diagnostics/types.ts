import { logger } from "../utils/logger.js";

export type Diagnostic = {
  ok: boolean;
  label: string;
  fix?: string;
};

export function printDiagnostic(diagnostic: Diagnostic): void {
  logger.info(`${diagnostic.ok ? "✓" : "✗"} ${diagnostic.label}`);
}

export function printFixes(diagnostics: Diagnostic[]): void {
  const failures = diagnostics.filter((diagnostic) => !diagnostic.ok);
  if (failures.length === 0) return;

  logger.info("");
  logger.info("Fix:");
  for (const failure of failures) {
    if (failure.fix) logger.info(failure.fix);
  }
}
