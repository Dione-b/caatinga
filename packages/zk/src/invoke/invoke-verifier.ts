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
    if (options.embedVk && isEmbeddedVkTrap(error)) {
      throw await embeddedVkTrapError(options.verifierContract, cwd);
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
 * which step the user is missing.
 */
async function embeddedVkTrapError(verifierContract: string, cwd: string): Promise<CaatingaError> {
  const message = `verify_proof_embedded trapped on "${verifierContract}", most likely because the deployed verifier still carries the placeholder verification key.`;
  if (await localVkIsPlaceholder(cwd)) {
    return new CaatingaError(
      message,
      CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
      "contracts/verifier/src/vk.rs is still the placeholder. Run `ctg zk build <circuit> --embed-vk`, then `ctg build verifier` and `ctg upgrade verifier --source <admin>`, then invoke again (a verifier deployed without an upgrade entrypoint needs one `ctg deploy verifier --upgrade`)."
    );
  }
  return new CaatingaError(
    message,
    CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
    "contracts/verifier/src/vk.rs has a real key, so the deployed contract is likely older than it. Run `ctg build verifier` and `ctg upgrade verifier --source <admin>`, then invoke again (a verifier deployed without an upgrade entrypoint needs one `ctg deploy verifier --upgrade`). If it still traps, the panic comes from the contract code itself."
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

function isEmbeddedVkTrap(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const cause = (error as { cause?: unknown }).cause;
  const text = [
    error.message,
    (error as { hint?: unknown }).hint,
    cause instanceof Error ? cause.message : cause,
  ]
    .filter((part) => typeof part === "string")
    .join("\n");
  return text.includes("UnreachableCodeReached") && text.includes("verify_proof_embedded");
}
