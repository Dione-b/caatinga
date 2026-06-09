import { logger } from "../utils/logger.js";

export type DiagnosticWarning = {
  code: string;
  message: string;
};

export type Diagnostic = {
  ok: boolean;
  label: string;
  fix?: string;
  warnings?: DiagnosticWarning[];
};

export function printDiagnostic(diagnostic: Diagnostic): void {
  const warnings = diagnostic.warnings ?? [];
  const suffix = warnings.length > 0 ? ` (${warnings.length} warning${warnings.length === 1 ? "" : "s"})` : "";

  logger.info(`${diagnostic.ok ? "✓" : "✗"} ${diagnostic.label}${suffix}`);

  for (const warning of warnings) {
    logger.info(`  ! ${warning.code}: ${warning.message}`);
  }
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
