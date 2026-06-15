import { invokeContract, loadConfig, readArtifacts, type CaatingaConfig } from "@caatinga/core";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serializeProof, type SnarkjsProof } from "../serialization/serialize-proof.js";
import { serializeVk, type SnarkjsVk } from "../serialization/serialize-vk.js";
import { ZkError } from "../errors/ZkError.js";

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

function concatG1(point: { x: Uint8Array; y: Uint8Array }): string {
  return Buffer.concat([point.x, point.y]).toString("hex");
}

function concatG2(point: { x: [Uint8Array, Uint8Array]; y: [Uint8Array, Uint8Array] }): string {
  return Buffer.concat([point.x[0], point.x[1], point.y[0], point.y[1]]).toString("hex");
}

export function buildStellarVerifyProofArgs(options: {
  proof: SnarkjsProof;
  vk?: SnarkjsVk;
  publicSignals: string[];
  embedVk: boolean;
}): string[] {
  const serializedProof = serializeProof(options.proof);
  const args: string[] = [];

  if (!options.embedVk) {
    if (!options.vk) {
      throw new ZkError("Verification key is required when embedVk is false.", "ZK_VK_REQUIRED");
    }

    const serializedVk = serializeVk(options.vk);
    args.push(
      "--vk",
      JSON.stringify({
        alpha: concatG1(serializedVk.alpha),
        beta: concatG2(serializedVk.beta),
        gamma: concatG2(serializedVk.gamma),
        delta: concatG2(serializedVk.delta),
        ic: serializedVk.ic.map(concatG1),
      })
    );
  }

  args.push(
    "--proof",
    JSON.stringify({
      a: concatG1(serializedProof.a),
      b: concatG2(serializedProof.b),
      c: concatG1(serializedProof.c),
    })
  );
  args.push("--pub_signals", JSON.stringify(options.publicSignals));

  return args;
}

export type InvokeVerifierResult = {
  network: string;
  verifierContract: string;
  contractId: string;
  publicSignals: string[];
  verified: true;
};

export async function invokeVerifier(options: InvokeVerifierOptions): Promise<InvokeVerifierResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? await loadConfig({ cwd });
  const proof = JSON.parse(await readFile(path.resolve(cwd, options.proofPath), "utf8")) as SnarkjsProof;
  const publicSignals = JSON.parse(
    await readFile(path.resolve(cwd, options.publicSignalsPath), "utf8")
  ) as string[];

  const vk = options.embedVk
    ? undefined
    : JSON.parse(await readFile(path.resolve(cwd, options.vkPath), "utf8")) as SnarkjsVk;

  const args = buildStellarVerifyProofArgs({
    proof,
    vk,
    publicSignals,
    embedVk: options.embedVk,
  });

  const target = `${options.verifierContract}.verify_proof`;
  const result = await invokeContract({
    config,
    target,
    args,
    networkName: options.network,
    source: options.sourceAccount,
    cwd,
  });

  if (!result.result) {
    throw new ZkError("Verifier invocation returned no result.", "ZK_INVOKE_FAILED");
  }

  if (result.result.trim().toLowerCase() !== "true") {
    throw new ZkError(
      `Verifier returned ${result.result.trim()}.`,
      "ZK_VERIFY_FAILED"
    );
  }

  const artifacts = await readArtifacts(cwd);
  const contractId = artifacts.networks[options.network]?.contracts[options.verifierContract]?.contractId;

  if (!contractId) {
    throw new ZkError(
      `No deployed artifact found for "${options.verifierContract}" on "${options.network}".`,
      "ZK_INVOKE_FAILED",
      "Run caatinga deploy before invoking the verifier."
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
