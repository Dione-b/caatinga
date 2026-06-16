import { concatG1Bytes, concatG2Bytes } from "../serialization/curve-bytes.js";
import { serializeProof, type SnarkjsProof } from "../serialization/serialize-proof.js";
import { serializeVk, type SnarkjsVk } from "../serialization/serialize-vk.js";
import { ZkError } from "../errors/ZkError.js";

export type VerifyProofBindingBuffers = {
  vk: {
    alpha: Uint8Array;
    beta: Uint8Array;
    gamma: Uint8Array;
    delta: Uint8Array;
    ic: Uint8Array[];
  };
  proof: {
    a: Uint8Array;
    b: Uint8Array;
    c: Uint8Array;
  };
  pub_signals: bigint[];
};

/** Matches Stellar contract bindings for groth16_verifier (`Proof`, `VerificationKey`, `u256[]`). */
export type VerifyProofBindingArgs = VerifyProofBindingBuffers;

export function buildVerifyProofBindingArgs(options: {
  proof: SnarkjsProof;
  vk: SnarkjsVk;
  publicSignals: string[];
}): VerifyProofBindingArgs {
  if (!options.vk) {
    throw new ZkError("Verification key is required.", "ZK_VK_REQUIRED");
  }

  const serializedProof = serializeProof(options.proof);
  const serializedVk = serializeVk(options.vk);

  return {
    vk: {
      alpha: concatG1Bytes(serializedVk.alpha),
      beta: concatG2Bytes(serializedVk.beta),
      gamma: concatG2Bytes(serializedVk.gamma),
      delta: concatG2Bytes(serializedVk.delta),
      ic: serializedVk.ic.map(concatG1Bytes),
    },
    proof: {
      a: concatG1Bytes(serializedProof.a),
      b: concatG2Bytes(serializedProof.b),
      c: concatG1Bytes(serializedProof.c),
    },
    pub_signals: options.publicSignals.map((signal) => BigInt(signal)),
  };
}
