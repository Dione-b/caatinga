import { describe, expect, it } from "vitest";
import { sourceDiagnostic } from "./doctor.command.js";

describe("sourceDiagnostic", () => {
  it("rejects a public G address without asking Stellar CLI to resolve it", async () => {
    const diagnostic = await sourceDiagnostic("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");

    expect(diagnostic).toEqual(expect.objectContaining({
      ok: false,
      label: expect.stringContaining("unsafe"),
      fix: expect.stringContaining("Stellar CLI identity")
    }));
  });

  it("rejects a secret-shaped source without asking Stellar CLI to resolve it", async () => {
    const diagnostic = await sourceDiagnostic("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

    expect(diagnostic).toEqual(expect.objectContaining({
      ok: false,
      label: expect.stringContaining("unsafe"),
      fix: expect.stringContaining("identity alias")
    }));
  });

  it("rejects a seed phrase-shaped source without asking Stellar CLI to resolve it", async () => {
    const diagnostic = await sourceDiagnostic("my seed phrase");

    expect(diagnostic).toEqual(expect.objectContaining({
      ok: false,
      label: expect.stringContaining("unsafe"),
      fix: expect.stringContaining("identity alias")
    }));
  });
});
