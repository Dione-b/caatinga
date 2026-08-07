import { describe, expect, it } from "vitest";
import { CaatingaError } from "./CaatingaError.js";
import { CaatingaErrorCode } from "./CaatingaErrorCode.js";
import { formatCaatingaError } from "./format-caatinga-error.js";

describe("formatCaatingaError", () => {
  it("renders code, message, and hint", () => {
    const error = new CaatingaError(
      "Failed to sign XDR.",
      CaatingaErrorCode.XDR_SIGN_FAILED,
      "Connect a wallet and approve the transaction."
    );

    expect(formatCaatingaError(error)).toBe(
      "[CAATINGA_XDR_SIGN_FAILED] Failed to sign XDR.\n\nConnect a wallet and approve the transaction."
    );
  });

  it("appends an Error cause as Details", () => {
    const error = new CaatingaError(
      "Failed to sign XDR.",
      CaatingaErrorCode.XDR_SIGN_FAILED,
      "Connect a wallet and approve the transaction.",
      new Error("User declined the signature request")
    );

    const output = formatCaatingaError(error);
    expect(output).toContain("[CAATINGA_XDR_SIGN_FAILED] Failed to sign XDR.");
    expect(output).toContain("Details: User declined the signature request");
  });

  it("appends a string cause as Details", () => {
    const error = new CaatingaError(
      "Failed to sign XDR.",
      CaatingaErrorCode.XDR_SIGN_FAILED,
      "Connect a wallet and approve the transaction.",
      "example-increment-xdr"
    );

    expect(formatCaatingaError(error)).toContain("Details: example-increment-xdr");
  });

  it("omits Details when there is no cause", () => {
    const error = new CaatingaError(
      "Placeholder bindings are still in use.",
      CaatingaErrorCode.PLACEHOLDER_BINDING,
      "Run ctg generate."
    );

    expect(formatCaatingaError(error)).not.toContain("Details:");
  });

  it("falls back to the plain message for non-Caatinga errors", () => {
    expect(formatCaatingaError(new Error("boom"))).toBe("boom");
    expect(formatCaatingaError("just a string")).toBe("just a string");
  });
});
