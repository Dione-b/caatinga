import {
  assertSupportedCurve,
  g1FromSnarkjs,
  g2FromSnarkjs,
  type SerializedG1,
  type SerializedG2,
  type SnarkjsG1,
  type SnarkjsG2,
} from "./curve-points.js";

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
  vk_alpha_1: SnarkjsG1;
  vk_beta_2: SnarkjsG2;
  vk_gamma_2: SnarkjsG2;
  vk_delta_2: SnarkjsG2;
  vk_ic?: SnarkjsG1[];
  IC?: SnarkjsG1[];
};

export function serializeVk(vk: SnarkjsVk): SerializedVk {
  assertSupportedCurve(vk.curve);

  const ic = vk.vk_ic ?? vk.IC;
  if (!ic) {
    throw new Error("Verification key is missing vk_ic/IC entries.");
  }

  return {
    alpha: g1FromSnarkjs(vk.vk_alpha_1),
    beta: g2FromSnarkjs(vk.vk_beta_2),
    gamma: g2FromSnarkjs(vk.vk_gamma_2),
    delta: g2FromSnarkjs(vk.vk_delta_2),
    ic: ic.map(g1FromSnarkjs),
  };
}
