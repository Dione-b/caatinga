import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  CaatingaArtifactsSchema,
  CURRENT_ARTIFACTS_SCHEMA_VERSION,
  type CaatingaArtifacts,
} from "./artifact.schema.js";

export async function readArtifacts(cwd = process.cwd()): Promise<CaatingaArtifacts> {
  const artifactsPath = path.resolve(cwd, "caatinga.artifacts.json");

  try {
    const json = await readFile(artifactsPath, "utf8");
    const parsedJson = JSON.parse(json);

    if (parsedJson && typeof parsedJson === "object" && "version" in parsedJson) {
      const version = Number(parsedJson.version);
      if (version > CURRENT_ARTIFACTS_SCHEMA_VERSION) {
        throw new CaatingaError(
          `caatinga.artifacts.json version ${version} is not supported by this CLI version.`,
          CaatingaErrorCode.ARTIFACT_INVALID,
          "Upgrade your @caatinga/cli package to the latest version to support this artifacts schema version."
        );
      }
    }

    return CaatingaArtifactsSchema.parse(parsedJson);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CaatingaError(
        "caatinga.artifacts.json was not found.",
        CaatingaErrorCode.ARTIFACT_NOT_FOUND,
        "Run ctg init, or create the artifacts file before deploying or generating bindings."
      );
    }

    if (error instanceof SyntaxError) {
      throw new CaatingaError(
        "caatinga.artifacts.json is invalid.",
        CaatingaErrorCode.ARTIFACT_INVALID,
        "Fix the JSON syntax before running Caatinga commands. See docs/recovery-scenarios.md#invalid-artifacts."
      );
    }

    if (error instanceof z.ZodError) {
      const details = error.issues
        .map((issue) => {
          const field = issue.path.length > 0 ? issue.path.join(".") : "<root>";
          return `${field}: ${issue.message}`;
        })
        .join("; ");

      throw new CaatingaError(
        `caatinga.artifacts.json failed validation${details ? ` (${details})` : ""}.`,
        CaatingaErrorCode.ARTIFACT_INVALID,
        "Fix or remove the named artifact entry, then rerun the command. See docs/recovery-scenarios.md#invalid-artifacts."
      );
    }

    throw error;
  }
}
