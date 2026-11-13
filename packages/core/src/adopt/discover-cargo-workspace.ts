import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { CURRENT_RUST_WASM_TARGET } from "../contracts/wasm-targets.js";

/**
 * The conventional wasm artifact name for a crate. Cargo names cdylib outputs
 * after the crate with dashes replaced by underscores (e.g. the crate
 * `hello-world` builds `hello_world.wasm`); we probe both spellings because
 * contract crates are free to choose either style for their lib name.
 */
export function wasmArtifactNameCandidates(crateName: string): string[] {
  const underscored = crateName.replace(/-/g, "_");
  const candidates = [crateName, underscored];
  return Array.from(new Set(candidates));
}

export type DiscoveredContract = {
  /** Cargo package name of the member crate. */
  name: string;
  /** Directory of the member crate, relative to the workspace root. */
  memberPath: string;
  /** Relative wasm path suitable for a `caatinga.config.ts` `wasm` entry. */
  wasmPath: string;
  /** Whether the wasm binary already exists on disk (it may not — `ctg build` has to run first). */
  wasmOnDisk: boolean;
};

export type DiscoverCargoWorkspaceResult = {
  /** Absolute path of the workspace root that was scanned. */
  workspaceRoot: string;
  /** `[package] name` of the root Cargo.toml, when it declares one. */
  packageName?: string;
  contracts: DiscoveredContract[];
};

type ParsedMemberCargo = {
  packageName?: string;
  isCdylib: boolean;
};

/**
 * Parses the subset of a member `Cargo.toml` we need: `[package] name` and
 * whether the crate declares `crate-type = ["cdylib"]` (the shape of a
 * Soroban contract crate). A line-oriented scan is enough here — none of the
 * fields we read appear inside multi-line strings in practice, and the whole
 * point of discovery is to be dependency-free.
 */
export function parseMemberCargoManifest(source: string): ParsedMemberCargo {
  let currentSection = "";
  let packageName: string | undefined;
  let isCdylib = false;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    if (currentSection === "package") {
      const nameMatch = line.match(/^name\s*=\s*"([^"]+)"/);
      if (nameMatch) {
        packageName = nameMatch[1];
      }
    }

    if (currentSection === "lib") {
      const crateTypeMatch = line.match(/^crate-type\s*=\s*\[([^\]]*)\]/);
      if (crateTypeMatch && /"cdylib"/.test(crateTypeMatch[1])) {
        isCdylib = true;
      }
    }
  }

  return { packageName, isCdylib };
}

/**
 * Extracts the `members` array from a root `Cargo.toml` `[workspace]` section.
 * Supports the two shapes real Soroban workspaces use: explicit entries and a
 * single-level `dir/*` glob. A glob only expands one level, matching how the
 * Soroban CLI's own templates lay out contracts.
 */
export function parseWorkspaceMembers(source: string): string[] {
  let inWorkspace = false;
  let inMembersArray = false;
  const members: string[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]/);
    if (sectionMatch) {
      inWorkspace = sectionMatch[1].trim() === "workspace";
      inMembersArray = false;
      continue;
    }

    if (!inWorkspace) {
      continue;
    }

    const inlineMembers = line.match(/^members\s*=\s*\[([^\]]*)\]/);
    if (inlineMembers) {
      members.push(...parseMemberEntries(inlineMembers[1]));
      continue;
    }

    if (/^members\s*=\s*\[\s*$/.test(line)) {
      inMembersArray = true;
      continue;
    }

    if (inMembersArray) {
      if (line.startsWith("]")) {
        inMembersArray = false;
        continue;
      }
      members.push(...parseMemberEntries(line));
    }
  }

  return members;
}

function parseMemberEntries(fragment: string): string[] {
  const entries: string[] = [];
  for (const entry of fragment.split(",")) {
    const trimmed = entry.trim().replace(/^"|"$/g, "").trim();
    if (trimmed.length > 0 && !trimmed.startsWith("#")) {
      entries.push(trimmed);
    }
  }
  return entries;
}

async function expandMemberGlob(root: string, member: string): Promise<string[]> {
  if (!member.endsWith("/*")) {
    return [member];
  }

  const base = member.slice(0, -2);
  try {
    const entries = await readdir(path.resolve(root, base), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${base}/${entry.name}`);
  } catch {
    // A glob whose base directory does not exist yields nothing; `adopt`
    // surfaces the empty-discovery problem through its own reporting.
    return [];
  }
}

async function resolveWasmPath(
  root: string,
  memberPath: string,
  crateName: string
): Promise<{ wasmPath: string; wasmOnDisk: boolean }> {
  const cargoTargetDir = process.env.CARGO_TARGET_DIR;
  const usesCargoTargetDir = Boolean(cargoTargetDir && cargoTargetDir.trim().length > 0);
  const targetRoot = usesCargoTargetDir
    ? path.resolve(root, cargoTargetDir as string)
    : path.resolve(root, memberPath, "target");
  const baseDir = path.join(targetRoot, CURRENT_RUST_WASM_TARGET, "release");

  for (const candidate of wasmArtifactNameCandidates(crateName)) {
    const onDisk = path.join(baseDir, `${candidate}.wasm`);
    try {
      await stat(onDisk);
      // The config entry is always member-relative so the project stays
      // portable; a custom CARGO_TARGET_DIR is written as an absolute path
      // because the convention only breaks inside this checkout.
      const wasmPath = usesCargoTargetDir
        ? onDisk.replace(/\\/g, "/")
        : `${memberPath}/target/${CURRENT_RUST_WASM_TARGET}/release/${candidate}.wasm`;
      return { wasmPath, wasmOnDisk: true };
    } catch {
      // Try the next spelling.
    }
  }

  const [firstSpelling] = wasmArtifactNameCandidates(crateName);
  const wasmPath = `${
    usesCargoTargetDir
      ? `${targetRoot.replace(/\\/g, "/")}/${CURRENT_RUST_WASM_TARGET}/release`
      : `${memberPath}/target/${CURRENT_RUST_WASM_TARGET}/release`
  }/${firstSpelling}.wasm`;
  return { wasmPath, wasmOnDisk: false };
}

/**
 * Discovers contract crates inside an existing Cargo workspace so `ctg adopt`
 * can write a `caatinga.config.ts` without redeploying anything.
 *
 * Only crates that declare `crate-type = ["cdylib"]` under `[lib]` are treated
 * as Soroban contracts; plain library/binary members of the workspace are
 * reported in the result but skipped for config generation.
 */
export async function discoverCargoWorkspace(
  cwd: string
): Promise<DiscoverCargoWorkspaceResult> {
  const rootManifestPath = path.resolve(cwd, "Cargo.toml");
  let rootSource: string;

  try {
    rootSource = await readFile(rootManifestPath, "utf8");
  } catch {
    throw new CaatingaError(
      "No Cargo.toml found at the project root.",
      CaatingaErrorCode.CONFIG_NOT_FOUND,
      "Run ctg adopt from a Soroban workspace root (the directory that owns the [workspace] Cargo.toml)."
    );
  }

  const members = parseWorkspaceMembers(rootSource);
  if (members.length === 0) {
    throw new CaatingaError(
      "Cargo.toml declares no [workspace] members.",
      CaatingaErrorCode.CONFIG_NOT_FOUND,
      "ctg adopt discovers contracts from [workspace] members — add your contract crates to the members list first."
    );
  }

  const rootPackageName = rootSource.match(/^\[package\][\s\S]*?^name\s*=\s*"([^"]+)"/m)?.[1];
  const contracts: DiscoveredContract[] = [];

  for (const member of members) {
    const expanded = await expandMemberGlob(cwd, member);
    for (const memberPath of expanded) {
      let memberSource: string;
      try {
        memberSource = await readFile(path.resolve(cwd, memberPath, "Cargo.toml"), "utf8");
      } catch {
        // A workspace member that is a path dependency outside the repo (or a
        // stray glob match without a manifest) is not adoptable here.
        continue;
      }

      const parsed = parseMemberCargoManifest(memberSource);
      if (!parsed.packageName || !parsed.isCdylib) {
        continue;
      }

      const wasm = await resolveWasmPath(cwd, memberPath, parsed.packageName);
      contracts.push({
        name: parsed.packageName,
        memberPath,
        wasmPath: wasm.wasmPath,
        wasmOnDisk: wasm.wasmOnDisk,
      });
    }
  }

  if (contracts.length === 0) {
    throw new CaatingaError(
      "No Soroban contract crates found in the workspace.",
      CaatingaErrorCode.CONFIG_NOT_FOUND,
      "ctg adopt treats [workspace] members with crate-type = [\"cdylib\"] as contracts — declare that in each contract's Cargo.toml [lib] section."
    );
  }

  return {
    workspaceRoot: path.resolve(cwd),
    packageName: rootPackageName,
    contracts,
  };
}
