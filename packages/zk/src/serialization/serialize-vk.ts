import { decimalToBe48 } from "./bigint-helpers.js";
import type { SerializedG1, SerializedG2 } from "./serialize-proof.js";

export type SerializedVk = {
  alpha: SerializedG1;
  beta: SerializedG2;
  gamma: SerializedG2;
  delta: SerializedG2;
  ic: SerializedG1[];
};

export type SnarkjsVk = {
  protocol: string;
  curve: string;
  vk_alpha_1: [string, string, string];
  vk_beta_2: [[string, string], [string, string], ...string[][]];
  vk_gamma_2: [[string, string], [string, string], ...string[][]];
  vk_delta_2: [[string, string], [string, string], ...string[][]];
  vk_ic?: Array<[string, string, string]>;
  IC?: Array<[string, string, string]>;
};

function g2FromSnarkjsExport(rows: [[string, string], [string, string], ...string[][]]): SerializedG2 {
  return g2FromSnarkjs([rows[0]!, rows[1]!]);
}

function g1FromSnarkjs(p: [string, string, string]): SerializedG1 {
  return {
    x: decimalToBe48(p[0]),
    y: decimalToBe48(p[1]),
  };
}

function g2FromSnarkjs(p: [[string, string], [string, string]]): SerializedG2 {
  return {
    x: [decimalToBe48(p[0][1]), decimalToBe48(p[0][0])],
    y: [decimalToBe48(p[1][1]), decimalToBe48(p[1][0])],
  };
}

export function serializeVk(vk: SnarkjsVk): SerializedVk {
  if (vk.curve !== "bls12381") {
    throw new Error(`Expected curve bls12381, got ${vk.curve}`);
  }

  const ic = vk.vk_ic ?? vk.IC;
  if (!ic) {
    throw new Error("Verification key is missing vk_ic/IC entries.");
  }

  return {
    alpha: g1FromSnarkjs(vk.vk_alpha_1),
    beta: g2FromSnarkjsExport(vk.vk_beta_2),
    gamma: g2FromSnarkjsExport(vk.vk_gamma_2),
    delta: g2FromSnarkjsExport(vk.vk_delta_2),
    ic: ic.map(g1FromSnarkjs),
  };
}
