import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaatingaWalletAdapter } from "../types.js";
import {
  createWalletSession,
  WALLET_SESSION_STORAGE_KEY,
  type CaatingaWalletCapabilities,
  type WalletSessionStorage
} from "./wallet-session.js";

const PUBLIC_KEY = "GPUBLIC";

function createAdapter(
  overrides: Partial<CaatingaWalletAdapter & CaatingaWalletCapabilities> = {}
): CaatingaWalletAdapter & CaatingaWalletCapabilities {
  return {
    getPublicKey: vi.fn().mockResolvedValue(PUBLIC_KEY),
    signTransaction: vi.fn().mockResolvedValue("AAAA_SIGNED"),
    ...overrides
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
    }
  };
}

describe("createWalletSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts disconnected with a stable state reference", () => {
    const session = createWalletSession(createAdapter());

    expect(session.getState()).toEqual({
      status: "disconnected",
      publicKey: null,
      error: null
    });
    expect(session.getState()).toBe(session.getState());
  });

  it("connects via openModal when the adapter exposes it", async () => {
    const openModal = vi.fn().mockResolvedValue(PUBLIC_KEY);
    const adapter = createAdapter({ openModal });
    const session = createWalletSession(adapter);

    await expect(session.connect()).resolves.toBe(PUBLIC_KEY);

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(adapter.getPublicKey).not.toHaveBeenCalled();
    expect(session.getState()).toEqual({
      status: "connected",
      publicKey: PUBLIC_KEY,
      error: null
    });
  });

  it("falls back to getPublicKey for minimal adapters", async () => {
    const adapter = createAdapter();
    const session = createWalletSession(adapter);

    await expect(session.connect()).resolves.toBe(PUBLIC_KEY);

    expect(adapter.getPublicKey).toHaveBeenCalledTimes(1);
    expect(session.getState().status).toBe("connected");
  });

  it("notifies subscribers in connecting → connected order", async () => {
    const session = createWalletSession(createAdapter());
    const statuses: string[] = [];
    session.subscribe(() => {
      statuses.push(session.getState().status);
    });

    await session.connect();

    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("stops notifying after unsubscribe", async () => {
    const session = createWalletSession(createAdapter());
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    unsubscribe();

    await session.connect();

    expect(listener).not.toHaveBeenCalled();
  });

  it("records the rejection and rethrows when connect fails", async () => {
    const rejection = new Error("User dismissed");
    const adapter = createAdapter({
      getPublicKey: vi.fn().mockRejectedValue(rejection)
    });
    const session = createWalletSession(adapter);

    await expect(session.connect()).rejects.toBe(rejection);

    expect(session.getState()).toEqual({
      status: "disconnected",
      publicKey: null,
      error: rejection
    });
  });

  it("enforces the configured timeout with the existing wallet timeout error", async () => {
    vi.useFakeTimers();
    const adapter = createAdapter({
      getPublicKey: vi.fn().mockImplementation(() => new Promise(() => {}))
    });
    const session = createWalletSession(adapter, { timeout: 50 });

    const pending = session.connect();
    const assertion = expect(pending).rejects.toMatchObject({
      code: "CAATINGA_WALLET_TIMEOUT"
    });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;

    expect(session.getState().status).toBe("disconnected");
    expect(session.getState().error).toMatchObject({ code: "CAATINGA_WALLET_TIMEOUT" });
  });

  it("persists the wallet id and restores silently", async () => {
    const storage = createMemoryStorage();
    const setWallet = vi.fn();
    const adapter = createAdapter({
      openModal: vi.fn().mockResolvedValue(PUBLIC_KEY),
      getWalletId: vi.fn().mockReturnValue("freighter"),
      setWallet
    });
    const session = createWalletSession(adapter, { persist: true, storage });

    await session.connect();

    expect(JSON.parse(storage.data.get(WALLET_SESSION_STORAGE_KEY)!)).toEqual({
      v: 1,
      walletId: "freighter"
    });

    const nextSession = createWalletSession(adapter, { persist: true, storage });
    await expect(nextSession.restore()).resolves.toBe(PUBLIC_KEY);

    expect(setWallet).toHaveBeenCalledWith("freighter");
    expect(adapter.getPublicKey).toHaveBeenCalledTimes(1);
    expect(nextSession.getState().status).toBe("connected");
  });

  it("restore resolves null without touching the adapter when nothing was persisted", async () => {
    const adapter = createAdapter();
    const session = createWalletSession(adapter, {
      persist: true,
      storage: createMemoryStorage()
    });

    await expect(session.restore()).resolves.toBeNull();

    expect(adapter.getPublicKey).not.toHaveBeenCalled();
    expect(session.getState().status).toBe("disconnected");
  });

  it("restore failure clears persistence and never sets an error", async () => {
    const storage = createMemoryStorage();
    storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify({ v: 1 }));
    const adapter = createAdapter({
      getPublicKey: vi.fn().mockRejectedValue(new Error("locked"))
    });
    const session = createWalletSession(adapter, { persist: true, storage });

    await expect(session.restore()).resolves.toBeNull();

    expect(storage.data.has(WALLET_SESSION_STORAGE_KEY)).toBe(false);
    expect(session.getState()).toEqual({
      status: "disconnected",
      publicKey: null,
      error: null
    });
  });

  it("restore ignores corrupted persisted payloads", async () => {
    const storage = createMemoryStorage();
    storage.setItem(WALLET_SESSION_STORAGE_KEY, "{not json");
    const adapter = createAdapter();
    const session = createWalletSession(adapter, { persist: true, storage });

    await expect(session.restore()).resolves.toBeNull();
    expect(adapter.getPublicKey).not.toHaveBeenCalled();
  });

  it("disconnect resets state, clears persistence, and calls the adapter capability", async () => {
    const storage = createMemoryStorage();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const adapter = createAdapter({
      openModal: vi.fn().mockResolvedValue(PUBLIC_KEY),
      disconnect
    });
    const session = createWalletSession(adapter, { persist: true, storage });
    await session.connect();

    await session.disconnect();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(storage.data.size).toBe(0);
    expect(session.getState()).toEqual({
      status: "disconnected",
      publicKey: null,
      error: null
    });
  });

  it("restore returns the current key when already connected", async () => {
    const adapter = createAdapter();
    const session = createWalletSession(adapter);
    await session.connect();

    await expect(session.restore()).resolves.toBe(PUBLIC_KEY);
    expect(adapter.getPublicKey).toHaveBeenCalledTimes(1);
  });
});
