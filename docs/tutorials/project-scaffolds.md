# Choosing a Project Scaffold

Caatinga offers three ways to start a new project. Pick the path that matches how much UI and ZK tooling you want on day one.

Install the CLI and prerequisites first — see [Getting started — Prerequisites](../getting-started.md#prerequisites).

## Which path?

- Need a browser UI on day one? → **Template** or **ZK template**
- CLI + contract only? → **Minimal**
- Need Groth16 proofs on Soroban? → **ZK template** or **ZK minimal**

## Paths

### Template

```bash
caatinga init <dir>
```

Vite + React, wallet and bindings pre-wired. No ZK.

→ [Template project](./template-project.md)

### Minimal

```bash
caatinga init <dir> --minimal
```

CLI + `app` stub only. You pick the UI stack later.

→ [Minimal project](./minimal-project.md)

### ZK template

```bash
caatinga zk init <dir>
```

`zk-starter`: Vite UI + verifier contract + multiplier circuit. Hybrid CLI + browser flow.

→ [ZK project](./zk-project.md)

### ZK minimal

```bash
caatinga zk init <dir> --minimal
```

Verifier + identity circuit only. No frontend — add UI yourself.

→ [ZK project](./zk-project.md)

## Aliases

- `caatinga init --empty` is the same as `--minimal`.
- `caatinga zk init` with **no** project name adds ZK files to the **current** directory (see [ZK project](./zk-project.md#add-zk-to-an-existing-project)).

## Official templates

- **`react-vite-counter`** (default) — `npx caatinga init my-dapp` — stable; recommended for the first walkthrough
- **`zk-starter`** — `npx caatinga zk init my-zk-dapp` — stable ZK example with Vite + React shell

See [Templates](../templates.md) for manifest details and package-manager notes.

## Related docs

- [Getting started](../getting-started.md)
- [From Zero to Testnet](./from-zero-to-testnet.md)
