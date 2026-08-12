import { z } from "zod";
import semver from "semver";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { CAATINGA_CORE_VERSION } from "../version.js";

export const CURRENT_TEMPLATE_VERSION = 1;

export const TemplateManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  caatinga: z.object({
    compatibleCore: z.string().min(1),
    templateVersion: z.number().int().positive(),
  }),
  frontend: z.object({
    framework: z.literal("vite-react"),
    packageManager: z.enum(["npm", "pnpm", "yarn", "bun"]).default("npm"),
  }),
  contracts: z.object({
    path: z.string(),
    default: z.string().optional(),
  }),
  files: z.object({
    config: z.string().default("caatinga.config.ts"),
    artifacts: z.string().default("caatinga.artifacts.json"),
  }),
});

export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;

export type TemplateCompatibilityIssue =
  | { kind: "template-version"; expected: number; actual: number }
  | { kind: "core-range"; requiredRange: string; runningVersion: string };

export function defaultCompatibleCoreRange(coreVersion = CAATINGA_CORE_VERSION): string {
  const version = semver.valid(semver.coerce(coreVersion));
  if (!version) {
    throw new CaatingaError(
      `Invalid core version: ${coreVersion}`,
      CaatingaErrorCode.INVALID_TEMPLATE_MANIFEST,
      "Use a semver-compatible core version such as 1.2.3."
    );
  }

  return `^${version}`;
}

export function isCoreVersionCompatible(
  range: string,
  coreVersion = CAATINGA_CORE_VERSION
): boolean {
  return semver.satisfies(coreVersion, range);
}

export function getTemplateCompatibilityIssue(
  manifest: TemplateManifest,
  coreVersion = CAATINGA_CORE_VERSION
): TemplateCompatibilityIssue | null {
  if (manifest.caatinga.templateVersion !== CURRENT_TEMPLATE_VERSION) {
    return {
      kind: "template-version",
      expected: CURRENT_TEMPLATE_VERSION,
      actual: manifest.caatinga.templateVersion,
    };
  }

  if (!isCoreVersionCompatible(manifest.caatinga.compatibleCore, coreVersion)) {
    return {
      kind: "core-range",
      requiredRange: manifest.caatinga.compatibleCore,
      runningVersion: coreVersion,
    };
  }

  return null;
}

export function formatTemplateCompatibilityMessage(issue: TemplateCompatibilityIssue): string {
  if (issue.kind === "template-version") {
    return `Template manifest version ${issue.actual} is not supported; Caatinga requires templateVersion ${issue.expected}.`;
  }

  return `Template requires @caatinga/core ${issue.requiredRange} but running ${issue.runningVersion}.`;
}

export function formatTemplateCompatibilityHint(issue: TemplateCompatibilityIssue): string {
  if (issue.kind === "template-version") {
    return "Use a template built for this Caatinga release or upgrade Caatinga.";
  }

  return `Use a template with compatibleCore ${defaultCompatibleCoreRange(issue.runningVersion)} or install a matching Caatinga version.`;
}

export function assertOfficialTemplateManifest(manifest: TemplateManifest): void {
  const expectedRange = defaultCompatibleCoreRange();
  if (manifest.caatinga.compatibleCore !== expectedRange) {
    throw new CaatingaError(
      `Official template compatibleCore must be ${expectedRange}, found ${manifest.caatinga.compatibleCore}.`,
      CaatingaErrorCode.INVALID_TEMPLATE_MANIFEST,
      `Set caatinga.compatibleCore to ${expectedRange} in the template manifest.`
    );
  }

  const issue = getTemplateCompatibilityIssue(manifest);
  if (issue) {
    throw new CaatingaError(
      formatTemplateCompatibilityMessage(issue),
      CaatingaErrorCode.TEMPLATE_INCOMPATIBLE,
      formatTemplateCompatibilityHint(issue)
    );
  }
}
