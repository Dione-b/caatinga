import { describe, it, expect } from "vitest";
import proofFixture from "../../test/fixtures/proof.json" with { type: "json" };
import vkFixture from "../../test/fixtures/verification_key.json" with { type: "json" };
import publicFixture from "../../test/fixtures/public.json" with { type: "json" };
import { serializeProof, type SnarkjsProof } from "./serialize-proof.js";
import { serializeVk, type SnarkjsVk } from "./serialize-vk.js";
import { serializePublicSignals } from "./serialize-public-signals.js";

const proof = proofFixture as SnarkjsProof;
const vk = vkFixture as SnarkjsVk;
const publicSignals = publicFixture as string[];

function hex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

describe("serializeProof", () => {
  it("matches the reference verifier test vectors", () => {
    const serialized = serializeProof(proof);

    expect(hex(serialized.a.x)).toBe(
      "0x020b003dd7c30b48c50b0ac89658c44f6df95140e0b26df9db0b131bdf6693b2762419fec015b7105cc8a3a9c2c9f66e"
    );
    expect(hex(serialized.a.y)).toBe(
      "0x0f7e46de574bc0bceec310891a4e478f80d52f990f140a849c89670ff336dc8d807690b828c71afc150abb4a673b768f"
    );
    expect(hex(serialized.b.x[0])).toBe(
      "0x1408146dae2316b8d761cd713cfbf67668c96aa1396e07a7e5fe390d52d27b070bce063eaaaa5085bc0fa8dfebb1eab1"
    );
    expect(hex(serialized.b.x[1])).toBe(
      "0x02c9481fc40c9b93357c32fcf451f0abb6979cf1f3b9c1b95a09baad4d5d85e72947593be24a91bd54a48bc05a8cb800"
    );
    expect(hex(serialized.b.y[0])).toBe(
      "0x17819481d43d40d8217f1214c36612ad0137167f8a927287d8bac5430909719558330c9167423aca5cd380f45000306a"
    );
    expect(hex(serialized.b.y[1])).toBe(
      "0x0a561f19e15a4d83c18f43ff90db2d2e42d8b6478350e364b51e1653a67be04a138b977f0898e660baff73db47cc533e"
    );
    expect(hex(serialized.c.x)).toBe(
      "0x13d5d7604e2e7428c31361918462f532128517d54285fbe7dac3b77fd03fdb6e6d39d466d00f40526577bf4fcc366513"
    );
    expect(hex(serialized.c.y)).toBe(
      "0x0d2d6925ce5273a590dab9ad1d986da00a02798ee737cb9b273635d2a9da3b69f9a9a0f724f05f637d480ebd6219a34d"
    );
  });

  it("rejects non-BLS12-381 proofs", () => {
    expect(() => serializeProof({ ...proof, curve: "bn128" })).toThrow();
  });
});

describe("serializeVk", () => {
  it("serializes the reference verification key", () => {
    const serialized = serializeVk(vk);
    expect(serialized.ic).toHaveLength(2);
    expect(serialized.alpha.x).toHaveLength(48);
    expect(serialized.beta.x[0]).toHaveLength(48);
  });

  it("rejects non-BLS12-381 keys", () => {
    expect(() => serializeVk({ ...vk, curve: "bn128" })).toThrow();
  });
});

describe("serializePublicSignals", () => {
  it("serializes public signals as little-endian 32-byte field elements", () => {
    const serialized = serializePublicSignals(publicSignals);
    expect(serialized).toHaveLength(1);
    expect(hex(serialized[0]!)).toBe(
      "0x2100000000000000000000000000000000000000000000000000000000000000"
    );
  });
});
