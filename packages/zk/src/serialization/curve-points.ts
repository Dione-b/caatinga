import { decimalToBe48 } from "./bigint-helpers.js";

export type SerializedG1 = {
  x: Uint8Array;
  y: Uint8Array;
};

export type SerializedG2 = {
  x: [Uint8Array, Uint8Array];
  y: [Uint8Array, Uint8Array];
};

/** Projective G1 point as snarkjs prints it: `[x, y, z]` in decimal. */
export type SnarkjsG1 = [string, string, string];
/** G2 point as snarkjs prints it: `[[x.c0, x.c1], [y.c0, y.c1], ...]` in decimal. */
export type SnarkjsG2 = [[string, string], [string, string], ...string[][]];

/** The only curve the Soroban verifier's BLS12-381 host functions accept. */
export const SUPPORTED_CURVE = "bls12381";

export function assertSupportedCurve(curve: string): void {
  if (curve !== SUPPORTED_CURVE) {
    throw new Error(`Expected curve ${SUPPORTED_CURVE}, got ${curve}`);
  }
}

export function g1FromSnarkjs(point: SnarkjsG1): SerializedG1 {
  return {
    x: decimalToBe48(point[0]),
    y: decimalToBe48(point[1]),
  };
}

/**
 * snarkjs orders each Fp2 coordinate as `[c0, c1]`; the Soroban host expects
 * `c1 || c0`, so both coordinates are swapped here.
 */
export function g2FromSnarkjs(point: SnarkjsG2): SerializedG2 {
  return {
    x: [decimalToBe48(point[0][1]), decimalToBe48(point[0][0])],
    y: [decimalToBe48(point[1][1]), decimalToBe48(point[1][0])],
  };
}
