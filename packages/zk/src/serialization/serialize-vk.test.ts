import { describe, it, expect } from "vitest";
import snarkjsExportFixture from "../../test/fixtures/verification_key_snarkjs_export.json" with { type: "json" };
import multiplierVkFixture from "../../test/fixtures/multiplier/verification_key.json" with { type: "json" };
import { serializeVk, type SnarkjsVk } from "./serialize-vk.js";
import type { SerializedG2 } from "./serialize-proof.js";

const snarkjsExport = snarkjsExportFixture as unknown as SnarkjsVk;
const multiplierVk = multiplierVkFixture as unknown as SnarkjsVk;

// BLS12-381 base field modulus; G2 lives on E'(Fp2): y^2 = x^3 + 4(1 + u), u^2 = -1.
const P = BigInt(
  "0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab"
);

type Fp2 = [bigint, bigint];

const mod = (a: bigint): bigint => ((a % P) + P) % P;
const mul = ([a0, a1]: Fp2, [b0, b1]: Fp2): Fp2 => [mod(a0 * b0 - a1 * b1), mod(a0 * b1 + a1 * b0)];

function toBigInt(bytes: Uint8Array): bigint {
  return BigInt("0x" + Buffer.from(bytes).toString("hex"));
}

/** Serialized G2 limbs are `[c1, c0]` (Soroban's encoding); the curve math wants `[c0, c1]`. */
function isOnG2Curve(point: SerializedG2): boolean {
  const x: Fp2 = [toBigInt(point.x[1]), toBigInt(point.x[0])];
  const y: Fp2 = [toBigInt(point.y[1]), toBigInt(point.y[0])];
  const lhs = mul(y, y);
  const x3 = mul(mul(x, x), x);
  return lhs[0] === mod(x3[0] + 4n) && lhs[1] === mod(x3[1] + 4n);
}

function swapG2Limbs(rows: SnarkjsVk["vk_beta_2"]): SnarkjsVk["vk_beta_2"] {
  return [
    [rows[0][1], rows[0][0]],
    [rows[1][1], rows[1][0]],
  ];
}

describe("serializeVk snarkjs export format", () => {
  it("accepts IC uppercase and G2 rows with three lines", () => {
    expect(snarkjsExport.IC).toBeDefined();
    expect(snarkjsExport.vk_ic).toBeUndefined();
    expect(snarkjsExport.vk_beta_2).toHaveLength(3);

    const serialized = serializeVk(snarkjsExport);

    expect(serialized.ic).toHaveLength(2);
    expect(serialized.alpha.x).toHaveLength(48);
    expect(serialized.beta.x[0]).toHaveLength(48);
  });
});

describe("serializeVk G2 limb order", () => {
  // snarkjs writes Fp2 limbs as `[c0, c1]` and serializeVk swaps them. A fixture
  // whose limbs were pre-swapped by hand serializes to points that are not on the
  // curve, which the verifier reports as "bls12-381 G2: point not on curve".
  it.each([
    ["verification_key_snarkjs_export.json", snarkjsExport],
    ["multiplier/verification_key.json", multiplierVk],
  ])("should_serialize_%s_to_g2_points_on_the_curve", (_name, vk) => {
    const serialized = serializeVk(vk);

    expect(isOnG2Curve(serialized.beta)).toBe(true);
    expect(isOnG2Curve(serialized.gamma)).toBe(true);
    expect(isOnG2Curve(serialized.delta)).toBe(true);
  });

  it("should_produce_off_curve_points_from_a_vk_with_pre_swapped_limbs", () => {
    const preSwapped: SnarkjsVk = {
      ...multiplierVk,
      vk_beta_2: swapG2Limbs(multiplierVk.vk_beta_2),
    };

    expect(isOnG2Curve(serializeVk(preSwapped).beta)).toBe(false);
  });
});
