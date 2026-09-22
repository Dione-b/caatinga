export type StderrWarning = {
  message: string;
  remediation?: string;
};

/**
 * Writes a `{ message, remediation? }` warning to stderr. Shared by the
 * Stellar CLI and SDK compatibility checks' `onWarning` callbacks so
 * internal callers (e.g. `runCommand`, `generateBindings`) can opt a real
 * terminal into visible warnings without forcing stderr output on every
 * consumer of `checkStellarCliVersion`/`checkStellarSdkVersion`.
 */
export function emitWarningToStderr(warning: StderrWarning): void {
  const lines = [
    `Warning: ${warning.message}`,
    warning.remediation ? `  ${warning.remediation}` : undefined,
  ].filter((line): line is string => Boolean(line));

  process.stderr.write(`${lines.join("\n")}\n`);
}
