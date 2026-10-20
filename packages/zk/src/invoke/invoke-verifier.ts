import {
  CaatingaError,
  CaatingaErrorCode,
  invokeContract,
  loadConfig,
  readArtifacts,
  type CaatingaConfig,
} from "@caatinga/core";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { concatG1Hex, concatG2Hex } from "../serialization/curve-bytes.js";
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
        alpha: concatG1Hex(serializedVk.alpha),
        beta: concatG2Hex(serializedVk.beta),
        gamma: concatG2Hex(serializedVk.gamma),
        delta: concatG2Hex(serializedVk.delta),
        ic: serializedVk.ic.map(concatG1Hex),
      })
    );
  }

  args.push(
    "--proof",
    JSON.stringify({
      a: concatG1Hex(serializedProof.a),
      b: concatG2Hex(serializedProof.b),
      c: concatG1Hex(serializedProof.c),
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

export async function invokeVerifier(
  options: InvokeVerifierOptions
): Promise<InvokeVerifierResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? (await loadConfig({ cwd }));
  const proof = JSON.parse(
    await readFile(path.resolve(cwd, options.proofPath), "utf8")
  ) as SnarkjsProof;
  const publicSignals = JSON.parse(
    await readFile(path.resolve(cwd, options.publicSignalsPath), "utf8")
  ) as string[];

  const vk = options.embedVk
    ? undefined
    : (JSON.parse(await readFile(path.resolve(cwd, options.vkPath), "utf8")) as SnarkjsVk);

  const args = buildStellarVerifyProofArgs({
    proof,
    vk,
    publicSignals,
    embedVk: options.embedVk,
  });

  // The embedded-VK entrypoint takes no VK argument, so it is a separate
  // contract method rather than the same one called with fewer args.
  const method = options.embedVk ? "verify_proof_embedded" : "verify_proof";
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

/**
 * A trap in `verify_proof_embedded` is most often the scaffold's placeholder
 * `embedded_vk()`, which panics on purpose — but any panic in the contract looks
 * the same on chain, so the error says "likely" and the local `vk.rs` decides
 * which step the user is missing. The trap itself stays in the hint and the
 * original error stays as the cause, for when the guess is wrong.
 */
async function embeddedVkTrapError(
  verifierContract: string,
  cwd: string,
  cause: unknown,
  trapLines: string[]
): Promise<CaatingaError> {
  const message = `verify_proof_embedded trapped on "${verifierContract}", most likely because the deployed verifier still carries the placeholder verification key.`;
  const nextStep = (await localVkIsPlaceholder(cwd))
    ? "contracts/verifier/src/vk.rs is still the placeholder. Run `ctg zk build <circuit> --embed-vk`, then `ctg build verifier` and `ctg upgrade verifier --source <admin>`, then invoke again (a verifier deployed without an upgrade entrypoint needs one `ctg deploy verifier --upgrade`)."
    : "contracts/verifier/src/vk.rs has a real key, so the deployed contract is likely older than it. Run `ctg build verifier` and `ctg upgrade verifier --source <admin>`, then invoke again (a verifier deployed without an upgrade entrypoint needs one `ctg deploy verifier --upgrade`). If it still traps, the panic comes from the contract code itself.";
  return new CaatingaError(
    message,
    CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
    [nextStep, "Stellar CLI reported:", ...trapLines].join("\n"),
    cause
  );
}

async function localVkIsPlaceholder(cwd: string): Promise<boolean> {
  try {
    const source = await readFile(path.join(cwd, "contracts", "verifier", "src", "vk.rs"), "utf8");
    return source.includes("PLACEHOLDER");
  } catch {
    // No vk.rs at all means it was never generated either.
    return true;
  }
}

/**
 * The output lines reporting a VM trap in `verify_proof_embedded`, or none when
 * the failure is something else. Searches the error and its causes, since
 * `invokeContract` may re-wrap the Stellar CLI failure and move its output
 * (kept in `hint`) down into the cause.
 */
function embeddedVkTrapLines(error: unknown): string[] {
  const parts: string[] = [];
  let current = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const { hint, cause } = current as { hint?: unknown; cause?: unknown };
    parts.push(current.message);
    if (typeof hint === "string") {
      parts.push(hint);
    }
    if (typeof cause === "string") {
      parts.push(cause);
    }
    current = cause;
  }
  const text = parts.join("\n");
  if (!text.includes("verify_proof_embedded")) {
    return [];
  }
  const trapLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("UnreachableCodeReached"));
  return [...new Set(trapLines)];
}
