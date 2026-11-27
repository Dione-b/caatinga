import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommand = vi.hoisted(() => vi.fn());

const VALID_G_ADDRESS = "G" + "A".repeat(55);

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

import {
  looksLikeStellarAlias,
  resolveCliMethodArgs,
  resolveMethodArgs,
} from "./resolve-method-args.js";

describe("resolveMethodArgs", () => {
  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockResolvedValue({
      stdout: VALID_G_ADDRESS,
      stderr: "",
      all: VALID_G_ADDRESS,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should_resolve_cli_alias_to_address", async () => {
    const result = await resolveMethodArgs({
      args: { caller: "alice" },
      cwd: "/tmp",
    });

    expect(result.caller).toBe(VALID_G_ADDRESS);
    expect(runCommand).toHaveBeenCalledWith(
      "stellar",
      ["keys", "address", "alice"],
      expect.any(Object)
    );
  });

  it("should_keep_resolved_address_unchanged", async () => {
    const address = "G" + "B".repeat(55);
    const result = await resolveMethodArgs({
      args: { admin: address },
    });

    expect(result.admin).toBe(address);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("should_throw_address_alias_unresolved_when_keys_lookup_fails", async () => {
    runCommand.mockRejectedValue(
      new CaatingaError("missing", CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED)
    );

    await expect(
      resolveMethodArgs({
        args: { caller: "missing" },
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.ADDRESS_ALIAS_UNRESOLVED });
  });

  it("should_identify_alias_like_strings", () => {
    expect(looksLikeStellarAlias("alice")).toBe(true);
    expect(looksLikeStellarAlias("G" + "A".repeat(55))).toBe(false);
    expect(looksLikeStellarAlias("${source.address}")).toBe(false);
  });

  it("should_not_treat_contract_ids_as_aliases", () => {
    expect(looksLikeStellarAlias("C" + "A".repeat(55))).toBe(false);
  });

  it("should_not_treat_muxed_addresses_as_aliases", () => {
    expect(looksLikeStellarAlias("M" + "A".repeat(68))).toBe(false);
  });

  it("should_not_treat_integers_as_aliases", () => {
    expect(looksLikeStellarAlias("100000000000")).toBe(false);
    expect(looksLikeStellarAlias("-500")).toBe(false);
  });

  it("should_not_treat_64_char_hex_hashes_as_aliases", () => {
    expect(looksLikeStellarAlias("ab".repeat(32))).toBe(false);
    expect(looksLikeStellarAlias("AB".repeat(32))).toBe(false);
  });

  it("should_still_treat_alias_names_with_digits_as_aliases", () => {
    expect(looksLikeStellarAlias("alice2")).toBe(true);
    expect(looksLikeStellarAlias("funder-a")).toBe(true);
    expect(looksLikeStellarAlias("ab".repeat(31))).toBe(true);
  });

  it("should_pass_resolved_contract_ids_and_numbers_through_unchanged", async () => {
    const contractId = "C" + "B".repeat(55);
    const hash = "0f".repeat(32);
    const result = await resolveMethodArgs({
      args: { auction: contractId, amount: "100000000000", doc_hash: hash },
    });

    expect(result).toEqual({ auction: contractId, amount: "100000000000", doc_hash: hash });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("should_keep_backslash_escaped_values_literal", async () => {
    const result = await resolveMethodArgs({
      args: { name: "\\Dione", caller: "alice" },
      cwd: "/tmp",
    });

    expect(result.name).toBe("Dione");
    expect(result.caller).toBe(VALID_G_ADDRESS);
  });

  it("should_skip_alias_resolution_when_resolve_aliases_is_false", async () => {
    const result = await resolveMethodArgs({
      args: { name: "Dione" },
      resolveAliases: false,
    });

    expect(result.name).toBe("Dione");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("should_mention_escape_and_flag_in_unresolved_hint", async () => {
    runCommand.mockRejectedValue(
      new CaatingaError("missing", CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED)
    );

    await expect(resolveMethodArgs({ args: { name: "Dione" } })).rejects.toMatchObject({
      code: CaatingaErrorCode.ADDRESS_ALIAS_UNRESOLVED,
      hint: expect.stringContaining("\\Dione"),
    });
  });

  it("should_resolve_named_cli_args_for_invoke", async () => {
    const resolved = await resolveCliMethodArgs(["--caller", "alice"], { cwd: "/tmp" });
    expect(resolved).toEqual(["--caller", VALID_G_ADDRESS]);
  });

  it("should_keep_escaped_named_cli_args_literal_for_invoke", async () => {
    const resolved = await resolveCliMethodArgs(["--name", "\\Dione"], { cwd: "/tmp" });
    expect(resolved).toEqual(["--name", "Dione"]);
  });

  it("should_reject_flag_shaped_named_argument_values", async () => {
    await expect(resolveCliMethodArgs(["--caller", "--help"])).rejects.toMatchObject({
      code: CaatingaErrorCode.INVALID_CONFIG,
    });
  });

  it("should_reject_invalid_named_argument_keys", async () => {
    await expect(resolveCliMethodArgs(["--bad-key", "value"])).rejects.toMatchObject({
      code: CaatingaErrorCode.INVALID_CONFIG,
    });
  });

  it("should_reject_standalone_short_flags", async () => {
    await expect(resolveCliMethodArgs(["-h"])).rejects.toMatchObject({
      code: CaatingaErrorCode.INVALID_CONFIG,
    });
  });
});
