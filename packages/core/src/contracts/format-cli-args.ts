import type { DeployArgValue } from "./resolve-deploy-args.js";

export function toSnakeCaseFlag(key: string): string {
  return key
    .replace(/([A-Z])/g, "_$1")
    .replace(/^_/, "")
    .toLowerCase();
}

export function formatConstructorCliArgs(resolved: Record<string, DeployArgValue>): string[] {
  return formatNamedCliArgs(resolved);
}

export function formatNamedCliArgs(resolved: Record<string, DeployArgValue>): string[] {
  const entries = Object.entries(resolved);
  if (entries.length === 0) {
    return [];
  }

  const tail: string[] = [];
  for (const [key, value] of entries) {
    tail.push(`--${toSnakeCaseFlag(key)}`, String(value));
  }
  return tail;
}
