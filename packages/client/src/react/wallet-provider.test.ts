// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CaatingaWalletAdapter } from "../types.js";
import {
  createWalletSession,
  WALLET_SESSION_STORAGE_KEY,
  type WalletSessionStorage,
} from "../wallet/wallet-session.js";
import { useWallet, useWalletSession, WalletProvider } from "./wallet-provider.js";

const PUBLIC_KEY = "GPUBLIC";

function createAdapter(overrides: Partial<CaatingaWalletAdapter> = {}): CaatingaWalletAdapter {
  return {
    getPublicKey: vi.fn().mockResolvedValue(PUBLIC_KEY),
    signTransaction: vi.fn().mockResolvedValue("AAAA_SIGNED"),
    ...overrides,
  };
}

function createMemoryStorage(): WalletSessionStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function providerWrapper(props: Parameters<typeof WalletProvider>[0]) {
  return ({ children }: { children?: ReactNode }) => createElement(WalletProvider, props, children);
}

describe("WalletProvider / useWallet", () => {
  it("throws a plain error when used outside the provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useWallet())).toThrow(
        "useWalletSession must be used within a <WalletProvider>."
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("exposes session state and connects through the hook", async () => {
    const adapter = createAdapter();
    const { result } = renderHook(() => useWallet(), {
      wrapper: providerWrapper({ adapter }),
    });

    expect(result.current.status).toBe("disconnected");
    expect(result.current.connected).toBe(false);

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.connecting).toBe(false);
    expect(result.current.publicKey).toBe(PUBLIC_KEY);
    expect(result.current.error).toBeNull();
  });

  it("surfaces connect rejections as state without unmount", async () => {
    const rejection = new Error("User dismissed");
    const adapter = createAdapter({
      getPublicKey: vi.fn().mockRejectedValue(rejection),
    });
    const { result } = renderHook(() => useWallet(), {
      wrapper: providerWrapper({ adapter }),
    });

    await act(async () => {
      await result.current.connect().catch(() => {});
    });

    expect(result.current.status).toBe("disconnected");
    expect(result.current.error).toBe(rejection);
  });

  it("auto-restores on mount when persistence is enabled", async () => {
    const storage = createMemoryStorage();
    storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify({ v: 1 }));
    const adapter = createAdapter();

    const { result } = renderHook(() => useWallet(), {
      wrapper: providerWrapper({ adapter, options: { persist: true, storage } }),
    });

    await act(async () => {});

    expect(adapter.getPublicKey).toHaveBeenCalledTimes(1);
    expect(result.current.connected).toBe(true);
    expect(result.current.publicKey).toBe(PUBLIC_KEY);
  });

  it("skips restore when autoConnect is false", async () => {
    const storage = createMemoryStorage();
    storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify({ v: 1 }));
    const adapter = createAdapter();

    const { result } = renderHook(() => useWallet(), {
      wrapper: providerWrapper({
        adapter,
        autoConnect: false,
        options: { persist: true, storage },
      }),
    });

    await act(async () => {});

    expect(adapter.getPublicKey).not.toHaveBeenCalled();
    expect(result.current.status).toBe("disconnected");
  });

  it("prefers an externally created session over the adapter prop", () => {
    const externalSession = createWalletSession(createAdapter());

    const { result } = renderHook(() => useWalletSession(), {
      wrapper: providerWrapper({
        adapter: createAdapter(),
        session: externalSession,
      }),
    });

    expect(result.current).toBe(externalSession);
  });
});
