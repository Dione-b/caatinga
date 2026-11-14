import { invokeContract, loadConfig, readArtifacts, type CaatingaConfig } from "@caatinga/core";
import path from "node:path";
import { readJsonFile } from "../artifacts/files.js";
import { ZkError } from "../errors/ZkError.js";
import type { SnarkjsProof } from "../serialization/serialize-proof.js";
import type { SnarkjsVk } from "../serialization/serialize-vk.js";
import {
  EMBEDDED_VK_METHOD,
  embeddedVkTrapError,
  embeddedVkTrapLines,
} from "./embedded-vk-trap.js";
import { buildStellarVerifyProofArgs } from "./verify-proof-args.js";

export type InvokeVerifierOptions = {
  verifierContract: string;
  network: string;
  sourceAccount: string;
  proofPath: string;
  vkPath: string;
  publicSignalsPath: string;
  embedVk: boolean;
  cwd?: string;
  config?: CaatingaConfig;
};

export type InvokeVerifierResult = {
  network: string;
  verifierContract: string;
  contractId: string;
  publicSignals: string[];
  verified: true;
};

export async function invokeVerifier(
  options: InvokeVerifierOptions
): Promise<InvokeVerifierResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? (await loadConfig({ cwd }));
  const proof = await readJsonFile<SnarkjsProof>(path.resolve(cwd, options.proofPath));
  const publicSignals = await readJsonFile<string[]>(path.resolve(cwd, options.publicSignalsPath));
  const vk = options.embedVk
    ? undefined
    : await readJsonFile<SnarkjsVk>(path.resolve(cwd, options.vkPath));

  const args = buildStellarVerifyProofArgs({
    proof,
    vk,
    publicSignals,
    embedVk: options.embedVk,
  });

  // The embedded-VK entrypoint takes no VK argument, so it is a separate
  // contract method rather than the same one called with fewer args.
  const method = options.embedVk ? EMBEDDED_VK_METHOD : "verify_proof";
  const target = `${options.verifierContract}.${method}`;
  let result: Awaited<ReturnType<typeof invokeContract>>;
  try {
    result = await invokeContract({
      config,
      target,
      args,
      networkName: options.network,
      source: options.sourceAccount,
      cwd,
    });
  } catch (error) {
    const trapLines = options.embedVk ? embeddedVkTrapLines(error) : [];
    if (trapLines.length > 0) {
      throw await embeddedVkTrapError(options.verifierContract, cwd, error, trapLines);
    }
    throw error;
  }

  if (!result.result) {
    throw new ZkError("Verifier invocation returned no result.", "ZK_INVOKE_FAILED");
  }

  if (result.result.trim().toLowerCase() !== "true") {
    throw new ZkError(`Verifier returned ${result.result.trim()}.`, "ZK_VERIFY_FAILED");
  }

  const artifacts = await readArtifacts(cwd);
  const contractId =
    artifacts.networks[options.network]?.contracts[options.verifierContract]?.contractId;

  if (!contractId) {
    throw new ZkError(
      `No deployed artifact found for "${options.verifierContract}" on "${options.network}".`,
      "ZK_INVOKE_FAILED",
      "Run ctg deploy before invoking the verifier."
    );
  }

  return {
    network: options.network,
    verifierContract: options.verifierContract,
    contractId,
    publicSignals,
    verified: true,
  };
}
