import { ZkError } from "../errors/ZkError.js";
import { concatG1Hex, concatG2Hex } from "../serialization/curve-bytes.js";
import { serializeProof, type SnarkjsProof } from "../serialization/serialize-proof.js";
import { serializeVk, type SnarkjsVk } from "../serialization/serialize-vk.js";

/**
 * Stellar CLI arguments for the verifier's `verify_proof` (dynamic VK) or
 * `verify_proof_embedded` (VK compiled into the contract, so none is passed).
 */
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
