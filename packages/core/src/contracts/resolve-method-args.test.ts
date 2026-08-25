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
});
