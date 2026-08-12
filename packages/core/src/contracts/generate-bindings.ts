import { access, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { writeBindingMarker, type BindingMarker } from "../bindings/binding-marker.js";
import { patchGeneratedBindingPackage } from "../bindings/patch-generated-binding-package.js";
import { ensureBufferDependency } from "../frontend/ensure-buffer-dependency.js";
import { frontendBindingsConfigHint } from "../frontend/bindings-config-hint.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { runCommand } from "../shell/run-command.js";
import { checkStellarSdkVersion } from "../stellar-sdk/check-stellar-sdk-version.js";
import { buildGenerateNetworkArgs } from "./build-generate-network-args.js";

export type GenerateBindingsOptions = {
  config: CaatingaConfig;
  contractName: string;
  networkName?: string;
  cwd?: string;
};

function toBindingImportPath(bindingsOutput: string, contractName: string): string {
  const normalized = bindingsOutput.replace(/^\.\//, "").split(path.sep).join("/");
  return `./${path.posix.join(normalized, contractName)}`;
}

export async function removeLegacyBindingStub(
  cwd: string,
  bindingsOutput: string,
  contractName: string
): Promise<boolean> {
  const legacyPath = path.resolve(cwd, bindingsOutput, `${contractName}.ts`);

  try {
    await access(legacyPath);
    await unlink(legacyPath);
    return true;
  } catch {
    return false;
  }
}

export async function generateBindings(options: GenerateBindingsOptions) {
  const cwd = options.cwd ?? process.cwd();
  if (!options.config.frontend) {
    throw new CaatingaError(
      "Frontend bindings are not configured.",
      CaatingaErrorCode.INVALID_CONFIG,
      frontendBindingsConfigHint()
    );
  }

  const network = resolveNetwork(options.config, options.networkName);
  const artifacts = await readArtifacts(cwd);
  const contractArtifact = artifacts.networks[network.name]?.contracts[options.contractName];

  if (!contractArtifact) {
    throw new CaatingaError(
      `No deployed artifact found for "${options.contractName}" on "${network.name}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run ctg deploy for this contract and network before generating bindings."
    );
  }

  const outputDir = path.resolve(cwd, options.config.frontend.bindingsOutput, options.contractName);
  await mkdir(outputDir, { recursive: true });

  await checkStellarSdkVersion({ cwd });

  const result = await runCommand(
    "npx",
    [
      "--yes",
      "@stellar/stellar-sdk",
      "generate",
      "--contract-id",
      contractArtifact.contractId,
      "--output-dir",
      outputDir,
      "--contract-name",
      options.contractName,
      "--overwrite",
      ...buildGenerateNetworkArgs(network),
    ],
    {
      cwd,
      failureCode: CaatingaErrorCode.BINDINGS_FAILED,
    }
  );

  const legacyStubRemoved = await removeLegacyBindingStub(
    cwd,
    options.config.frontend.bindingsOutput,
    options.contractName
  );

  await patchGeneratedBindingPackage(outputDir);

  // Generated bindings polyfill the `Buffer` global by importing `buffer`;
  // make sure the frontend declares it so the import resolves under every
  // package manager (notably pnpm, which won't hoist stellar-sdk's copy).
  const bufferDependency = await ensureBufferDependency(
    cwd,
    options.config.frontend.bindingsOutput
  );

  const marker: BindingMarker = {
    version: 1,
    contractId: contractArtifact.contractId,
    wasmHash: contractArtifact.wasmHash,
    network: network.name,
    generatedAt: new Date().toISOString(),
  };
  await writeBindingMarker(outputDir, marker);

  return {
    contractName: options.contractName,
    network,
    outputDir,
    importPath: toBindingImportPath(options.config.frontend.bindingsOutput, options.contractName),
    legacyStubRemoved,
    marker,
    bufferDependency,
    output: result.all || result.stdout,
  };
}
