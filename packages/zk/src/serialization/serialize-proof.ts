import { decimalToBe48 } from "./bigint-helpers.js";

export type SerializedG1 = {
  x: Uint8Array;
  y: Uint8Array;
};

export type SerializedG2 = {
  x: [Uint8Array, Uint8Array];
  y: [Uint8Array, Uint8Array];
};

export type SerializedProof = {
  a: SerializedG1;
  b: SerializedG2;
  c: SerializedG1;
};

export type SnarkjsProof = {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: string;
  curve: string;
};

export function serializeProof(proof: SnarkjsProof): SerializedProof {
  if (proof.curve !== "bls12381") {
    throw new Error(`Expected curve bls12381, got ${proof.curve}`);
  }

  return {
    a: {
      x: decimalToBe48(proof.pi_a[0]),
      y: decimalToBe48(proof.pi_a[1]),
    },
    b: {
      x: [decimalToBe48(proof.pi_b[0][1]), decimalToBe48(proof.pi_b[0][0])],
      y: [decimalToBe48(proof.pi_b[1][1]), decimalToBe48(proof.pi_b[1][0])],
    },
    c: {
      x: decimalToBe48(proof.pi_c[0]),
      y: decimalToBe48(proof.pi_c[1]),
    },
  };
}
