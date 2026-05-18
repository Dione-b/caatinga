import { describe, expect, it } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { createDefaultBindingAdapter } from "./default-binding-adapter.js";

describe("createDefaultBindingAdapter", () => {
  it("creates generated binding client with Caatinga connection inputs", () => {
    class Client {
      constructor(public readonly input: unknown) {}
    }

    const adapter = createDefaultBindingAdapter({ Client });
    const client = adapter.createClient({
      contractId: "CCOUNTER",
      publicKey: "GABC",
      rpcUrl: "https://rpc.example",
      networkPassphrase: "Test SDF Network ; September 2015"
    });

    expect(client).toBeInstanceOf(Client);
    expect((client as Client).input).toEqual({
      contractId: "CCOUNTER",
      publicKey: "GABC",
      rpcUrl: "https://rpc.example",
      networkPassphrase: "Test SDF Network ; September 2015"
    });
  });

  it("calls binding method with args object", async () => {
    class Client {
      transfer(args: Record<string, unknown>) {
        return { args };
      }
    }

    const adapter = createDefaultBindingAdapter({ Client });
    const client = new Client();

    await expect(
      adapter.callMethod({
        client,
        method: "transfer",
        args: { to: "GDEST", amount: 100n }
      })
    ).resolves.toEqual({ args: { to: "GDEST", amount: 100n } });
  });

  it("calls binding method without args", async () => {
    class Client {
      increment() {
        return { ok: true };
      }
    }

    const adapter = createDefaultBindingAdapter({ Client });

    await expect(adapter.callMethod({ client: new Client(), method: "increment" })).resolves.toEqual({
      ok: true
    });
  });

  it("throws when generated binding does not export Client", () => {
    const adapter = createDefaultBindingAdapter({});

    expect(() =>
      adapter.createClient({
        contractId: "CCOUNTER",
        publicKey: "GABC",
        rpcUrl: "https://rpc.example",
        networkPassphrase: "Test SDF Network ; September 2015"
      })
    ).toThrowError(CaatingaError);

    try {
      adapter.createClient({
        contractId: "CCOUNTER",
        publicKey: "GABC",
        rpcUrl: "https://rpc.example",
        networkPassphrase: "Test SDF Network ; September 2015"
      });
    } catch (error) {
      expect((error as CaatingaError).code).toBe(CaatingaErrorCode.BINDING_CLIENT_NOT_FOUND);
    }
  });

  it("throws when binding method is missing", async () => {
    class Client {}

    const adapter = createDefaultBindingAdapter({ Client });

    await expect(adapter.callMethod({ client: new Client(), method: "increment" })).rejects.toMatchObject({
      code: CaatingaErrorCode.BINDING_METHOD_NOT_FOUND
    });
  });
});
