import { afterEach, describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { assertSafeSourceAccount, resolveCliSource } from "./source-account.js";

describe("assertSafeSourceAccount", () => {
  it("should_throw_SOURCE_IS_PUBLIC_KEY_when_G_address", () => {
    expect(() =>
      assertSafeSourceAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_PUBLIC_KEY }));
  });

  it("should_throw_SOURCE_IS_SECRET_KEY_when_S_address", () => {
    expect(() =>
      assertSafeSourceAccount("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_SECRET_KEY }));
  });

  it("should_throw_SOURCE_IS_SEED_PHRASE_when_input_has_spaces", () => {
    expect(() => assertSafeSourceAccount("my seed phrase")).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_SEED_PHRASE })
    );
  });

  it("should_throw_UNSAFE_SOURCE_ACCOUNT_when_malformed_g_address", () => {
    expect(() => assertSafeSourceAccount("GSHORT")).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.UNSAFE_SOURCE_ACCOUNT })
    );
  });

  it("should_return_alias_when_non_secret_shape", () => {
    expect(assertSafeSourceAccount("alice")).toBe("alice");
  });

  it("should_throw_CAATINGA_SOURCE_ACCOUNT_REQUIRED_when_undefined", () => {
    try {
      assertSafeSourceAccount(undefined);
      expect.fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CaatingaError);
      expect((error as CaatingaError).code).toBe(CaatingaErrorCode.SOURCE_ACCOUNT_REQUIRED);
    }
  });
});

it("should_reject_flag_shaped_source_alias", () => {
  expect(() => assertSafeSourceAccount("--config-dir")).toThrowError(
    expect.objectContaining({ code: CaatingaErrorCode.UNSAFE_SOURCE_ACCOUNT })
  );
  expect(() => assertSafeSourceAccount("-h")).toThrowError(
    expect.objectContaining({ code: CaatingaErrorCode.UNSAFE_SOURCE_ACCOUNT })
  );
});

it("should_allow_non_secret_alias_starting_with_S", () => {
  expect(assertSafeSourceAccount("Staging")).toBe("Staging");
});
describe("resolveCliSource", () => {
  const previous = process.env.CAATINGA_SOURCE;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.CAATINGA_SOURCE;
    } else {
      process.env.CAATINGA_SOURCE = previous;
    }
  });

  it("should_default_to_alice_when_no_explicit_or_env", () => {
    delete process.env.CAATINGA_SOURCE;
    expect(resolveCliSource()).toBe("alice");
  });

  it("should_use_CAATINGA_SOURCE_when_set", () => {
    process.env.CAATINGA_SOURCE = "bob";
    expect(resolveCliSource()).toBe("bob");
  });

  describe("on mainnet", () => {
    const mainnet = {
      name: "production",
      config: {
        rpcUrl: "https://rpc.example.com",
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      },
    };

    it("should_refuse_the_alice_fallback_on_mainnet_detected_by_passphrase", () => {
      delete process.env.CAATINGA_SOURCE;
      expect(() => resolveCliSource(undefined, { network: mainnet })).toThrowError(
        expect.objectContaining({ code: CaatingaErrorCode.SOURCE_ACCOUNT_REQUIRED })
      );
    });

    it("should_accept_an_explicit_or_env_source_on_mainnet", () => {
      delete process.env.CAATINGA_SOURCE;
      expect(resolveCliSource("deployer", { network: mainnet })).toBe("deployer");
      process.env.CAATINGA_SOURCE = "bob";
      expect(resolveCliSource(undefined, { network: mainnet })).toBe("bob");
    });

    it("should_keep_the_alice_fallback_on_testnet", () => {
      delete process.env.CAATINGA_SOURCE;
      expect(
        resolveCliSource(undefined, {
          network: {
            name: "testnet",
            config: {
              rpcUrl: "https://soroban-testnet.stellar.org",
              networkPassphrase: "Test SDF Network ; September 2015",
            },
          },
        })
      ).toBe("alice");
    });
  });

  it("should_prefer_explicit_source_over_env", () => {
    process.env.CAATINGA_SOURCE = "bob";
    expect(resolveCliSource("carol")).toBe("carol");
  });
});
