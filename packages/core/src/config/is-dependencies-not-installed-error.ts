export function isDependenciesNotInstalledError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as NodeJS.ErrnoException & { message?: string; cause?: unknown };
  const code = candidate.code;
  const message = String(candidate.message ?? error);

  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
    return /@caatinga\/core/.test(message);
  }

  if (/Cannot find (module|package).+@caatinga\/core/i.test(message)) {
    return true;
  }

  if (candidate.cause !== undefined) {
    return isDependenciesNotInstalledError(candidate.cause);
  }

  return false;
}
