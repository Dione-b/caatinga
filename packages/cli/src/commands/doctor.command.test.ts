import { describe, expect, it } from "vitest";
import { sourceDiagnostic } from "./doctor.command.js";

describe("sourceDiagnostic", () => {
  it("rejects a public G address without asking Stellar CLI to resolve it", async () => {
    const diagnostic = await sourceDiagnostic("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");

    expect(diagnostic).toEqual(expect.objectContaining({
      ok: false,
      label: expect.stringContaining("CAATINGA_SOURCE_IS_PUBLIC_KEY"),
      fix: expect.stringContaining("Stellar CLI identity")
    }));
  });

  it("rejects a secret-shaped source without asking Stellar CLI to resolve it", async () => {
    const diagnostic = await sourceDiagnostic("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

    expect(diagnostic).toEqual(expect.objectContaining({
      ok: false,
      label: expect.stringContaining("CAATINGA_SOURCE_IS_SECRET_KEY"),
      fix: expect.stringContaining("identity alias")
    }));
  });

  it("rejects a seed phrase-shaped source without asking Stellar CLI to resolve it", async () => {
    const diagnostic = await sourceDiagnostic("my seed phrase");

    expect(diagnostic).toEqual(expect.objectContaining({
      ok: false,
      label: expect.stringContaining("CAATINGA_SOURCE_IS_SEED_PHRASE"),
      fix: expect.stringContaining("identity alias")
    }));
  });
});
