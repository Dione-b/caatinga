import { readdir } from "node:fs/promises";
import path from "node:path";
import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { BINDING_MARKER_FILENAME, readBindingMarker, type BindingMarker } from "./binding-marker.js";

export type BindingFreshnessStatus = "fresh" | "stale" | "missing" | "unknown";

export type BindingFreshness = {
  contractName: string;
  status: BindingFreshnessStatus;
  outputDir: string;
  marker: BindingMarker | null;
  reason?: string;
};

export type EvaluateBindingFreshnessOptions = {
  config: CaatingaConfig;
  artifacts: CaatingaArtifacts;
  networkName: string;
  contractName: string;
  cwd?: string;
};

async function listGeneratedEntries(outputDir: string): Promise<string[] | null> {
  try {
    const entries = await readdir(outputDir);
    return entries.filter((entry) => entry !== BINDING_MARKER_FILENAME);
  } catch {
    return null;
  }
}

export async function evaluateBindingFreshness(
  options: EvaluateBindingFreshnessOptions
): Promise<BindingFreshness> {
  const cwd = options.cwd ?? process.cwd();
  if (!options.config.frontend) {
    return {
      contractName: options.contractName,
      status: "unknown",
      outputDir: "",
      marker: null,
      reason: "frontend bindings are not configured"
    };
  }

  const outputDir = path.resolve(cwd, options.config.frontend.bindingsOutput, options.contractName);
  const contractArtifact =
    options.artifacts.networks[options.networkName]?.contracts[options.contractName];

  if (!contractArtifact) {
    return {
      contractName: options.contractName,
      status: "missing",
      outputDir,
      marker: null,
      reason: `not deployed on "${options.networkName}"`
    };
  }

  const generatedEntries = await listGeneratedEntries(outputDir);
  if (generatedEntries === null || generatedEntries.length === 0) {
    return {
      contractName: options.contractName,
      status: "missing",
      outputDir,
      marker: null,
      reason: "no generated bindings found"
    };
  }

  const marker = await readBindingMarker(outputDir);
  if (!marker) {
    return {
      contractName: options.contractName,
      status: "unknown",
      outputDir,
      marker: null,
      reason: "bindings exist but have no provenance marker — rerun caatinga generate to record it"
    };
  }

  if (marker.contractId !== contractArtifact.contractId) {
    return {
      contractName: options.contractName,
      status: "stale",
      outputDir,
      marker,
      reason: "contractId changed since last generate"
    };
  }

  if (marker.wasmHash !== contractArtifact.wasmHash) {
    return {
      contractName: options.contractName,
      status: "stale",
      outputDir,
      marker,
      reason: "wasmHash changed since last generate"
    };
  }

  return {
    contractName: options.contractName,
    status: "fresh",
    outputDir,
    marker
  };
}

export async function evaluateBindingsFreshness(options: {
  config: CaatingaConfig;
  artifacts: CaatingaArtifacts;
  networkName: string;
  cwd?: string;
}): Promise<BindingFreshness[]> {
  const contractNames = Object.keys(
    options.artifacts.networks[options.networkName]?.contracts ?? {}
  );

  const results: BindingFreshness[] = [];
  for (const contractName of contractNames) {
    results.push(await evaluateBindingFreshness({ ...options, contractName }));
  }
  return results;
}
