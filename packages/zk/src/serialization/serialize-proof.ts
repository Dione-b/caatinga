import {
  assertSupportedCurve,
  g1FromSnarkjs,
  g2FromSnarkjs,
  type SerializedG1,
  type SerializedG2,
} from "./curve-points.js";

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
  assertSupportedCurve(proof.curve);

  return {
    a: g1FromSnarkjs(proof.pi_a),
    b: g2FromSnarkjs(proof.pi_b),
    c: g1FromSnarkjs(proof.pi_c),
  };
}
