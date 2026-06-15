import { describe, it, expect } from "vitest";
import snarkjsExportFixture from "../../test/fixtures/verification_key_snarkjs_export.json" with { type: "json" };
import { serializeVk, type SnarkjsVk } from "./serialize-vk.js";

const snarkjsExport = snarkjsExportFixture as unknown as SnarkjsVk;

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
