# Integration guide

This guide shows how to drive a Caatinga project with the **stellar-build** AI agents. The
two tools work in complementary layers:

- **Structural layer — Caatinga.** Owns the technical lifecycle: Rust builds, topological
  multi-contract deploy via `dependsOn`, TypeScript binding generation, and the deployed
  state recorded in `caatinga.artifacts.json`.
- **Cognitive layer — stellar-build.** A set of AI personas and skills that attach to Claude
  Code or the Codex CLI. The agents *drive* Caatinga commands — they plan, prompt, and
  refine; they do not replace the CLI or talk to the network directly.

stellar-build is a separate, third-party project. This page documents how to wire it to a
Caatinga workspace; it is optional and not required to use Caatinga.

## Prerequisites

- A working Caatinga project. If you do not have one yet, follow
  [From Zero to Testnet](./from-zero-to-testnet.md) first.
- [Claude Code](https://github.com/anthropics/claude-code) or the Codex CLI installed.
- `git`, used by party-mode to isolate subagents in worktrees.

## Install the stellar-build skills (per-project)

stellar-build is installed per-project so its agents are scoped to the current workspace. The
canonical, up-to-date instructions live in the upstream repository:
[github.com/kaankacar/stellar-build](https://github.com/kaankacar/stellar-build).

The upstream install script populates the local `.claude/skills/` and `.codex/skills/`
directories when run with a project prefix:

```bash
curl -fsSL https://raw.githubusercontent.com/kaankacar/stellar-build/main/install.sh | bash -s -- --prefix=$(pwd)
```

::: warning Review before piping to a shell
This command pipes a remote script straight into `bash`. Download and read the script first,
and prefer a pinned tag or commit over `main`, so you know exactly what runs. Always follow
the upstream repository's own verified instructions as the source of truth.
:::

party-mode spawns subagents in git worktrees and needs a stable HEAD, so commit the workspace
after installing:

```bash
git init
git add .
git commit -m "chore: add caatinga workspace with stellar-build skills"
```

## Keep agents on the Caatinga rails (optional)

Caatinga keeps `caatinga.artifacts.json` and the `.caatinga-bindings.json` freshness markers
consistent. If agents run raw `stellar-cli` for build, deploy, or type generation, that state
drifts. To steer the agents, you can add a directive to stellar-build's learned profile at
`~/.stellar/profile.md` (or a project-local context file):

```md
This project uses @caatinga/cli as the Soroban lifecycle orchestrator. Do not run raw
stellar-cli for build, deploy, or binding generation. Route every network state change
(testnet, futurenet, mainnet) through `caatinga` commands so that caatinga.artifacts.json
and the .caatinga-bindings.json freshness markers stay consistent.
```

This is optional guidance, not a required edit. Adjust it to fit how your team works.

## Persona → command map

Each stellar-build persona maps naturally onto a phase of the Caatinga lifecycle. Use the
prompt phrasing as a starting point; every command is documented in the [CLI reference](../cli.md).

| Persona | Skill | Caatinga commands | Example prompt |
| --- | --- | --- | --- |
| Tyler — architect | `tyler-architect` | `caatinga zk init`, `caatinga build` | "Tyler, design the contract structure and validate the dependencies." |
| Elliot — developer | `elliot-dev` | `caatinga build`, `caatinga invoke` | "Elliot, implement the increment logic and run the invoke." |
| Nicole — product | `nicole-pm` | `caatinga deploy --network testnet` | "Nicole, validate the business rules and publish to testnet." |
| Justin — analyst | `justin-analyst` | `caatinga doctor`, `caatinga status` | "Justin, check the toolchain state and the binding freshness." |
| Bri — tech writer | `bri-tech-writer` | `caatinga inspect` | "Bri, inspect on-chain reachability and document the methods." |

## Edge cases

**Stale bindings.** When `caatinga status` reports a contract's bindings as `stale` (its
`contractId` or `wasmHash` changed since the last generate), ask the agent to run
`caatinga generate`. This refreshes the `.caatinga-bindings.json` marker without a redeploy.
See the [CLI reference](../cli.md) for `status` and `generate`.

**`CAATINGA_MULTI_AUTH_REQUIRED`.** A contract invoke that needs non-invoker signatures
raises this error. Multi-signer (`signAuthEntry`) orchestration is not supported in
`@caatinga/client` until v1.0. Refactor the flow to a single-invoker design, or handle the
extra signatures in application code. See [Errors](../errors.md) and
[Signing strategy](../signing-strategy.md).
