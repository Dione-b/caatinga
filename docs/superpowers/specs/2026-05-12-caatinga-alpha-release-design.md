# Caatinga v0.1.0-alpha Release Design

## Motivation

Ship an internal `v0.1.0-alpha` release that proves Caatinga's first coherent product slice:

```txt
init -> build -> deploy -> generate -> invoke
```

plus the new `@caatinga/client` interop layer for generated bindings, artifacts, XDR visibility, and wallet signing.

The alpha is not a public npm launch. It is a tagged internal checkpoint that makes the supported surface auditable and repeatable.

## Non-goals

- Publish packages to npm.
- Implement `caatinga doctor`.
- Implement CLI XDR commands.
- Implement `caatinga generate --interop`.
- Implement React hooks.
- Require testnet access in default CI.
- Implement multi-contract dependency deploy.
- Store private keys or sign with secret keys.
- Reimplement Stellar SDK, generated bindings, XDR parsing, or SCVal serialization.

## Prior Art

### Current CLI/Core MVP

The existing CLI/core flow already exposes:

- `caatinga init`
- `caatinga build`
- `caatinga deploy`
- `caatinga generate`
- `caatinga invoke`

It persists deployment facts in `caatinga.artifacts.json` and isolates Stellar CLI parsing in `@caatinga/core`.

### Current `@caatinga/client`

The current client implementation adds:

- `createCaatingaClient`
- `client.contract(name).invoke(method)`
- `client.contract(name).buildXdr(method)`
- `freighterWalletAdapter`
- artifact-based contract ID resolution
- default generated binding adapter

### Rejected Alternatives

#### Alpha without `@caatinga/client`

Rejected because the user explicitly included `@caatinga/client` in the alpha scope. Cutting it would make the tag less representative of the project's current product direction.

#### Alpha with public npm publish

Rejected because package metadata, provenance, publishing automation, README badges, npm access, release notes, and public compatibility promises are not yet designed.

#### Alpha requiring live testnet CI

Rejected because default CI must remain deterministic and not depend on external network state, funded accounts, wallet approval, or Stellar testnet availability.

#### Alpha with `doctor`

Rejected for this release because the user explicitly deferred `doctor`. The alpha can document prerequisite checks without implementing a diagnostic command.

## Interface Contract

### Release Tag

The release tag is:

```txt
v0.1.0-alpha
```

The tag represents an internal checkpoint, not a public stability guarantee.

### Included Packages

```txt
@caatinga/cli
@caatinga/core
@caatinga/client
packages/templates/react-vite-counter
```

### Supported CLI Surface

The alpha supports:

```txt
caatinga init <projectName>
caatinga build [contract]
caatinga deploy <contract> --network <network> --source <identity>
caatinga generate <contract> --network <network>
caatinga invoke <contract.method> --network <network> --source <identity> [args...]
```

### Supported Client Surface

The alpha supports:

```ts
createCaatingaClient(config)
client.contract("counter").invoke("increment")
client.contract("counter").buildXdr("increment")
freighterWalletAdapter
```

The client must:

- resolve `contractId` from explicit registration before artifacts;
- resolve `contractId` from `artifacts.networks[network].contracts[contract].contractId`;
- call generated binding methods through an adapter;
- send signing through `CaatingaWalletAdapter.signTransaction`;
- omit XDR unless `debugXdr` is enabled;
- omit raw data unless `debugRaw` is enabled;
- avoid private key storage;
- avoid manual SCVal serialization;
- avoid manual XDR parsing.

### Template Contract

The `react-vite-counter` template must remain buildable and aligned with the documented alpha workflow.

For option B, the template must have a documented client smoke path. It does not need to make `@caatinga/client` the only or default UI path if doing so would require generated bindings or live wallet state during template CI.

### Error Contract

All public failures emitted by Caatinga code must use documented `CAATINGA_*` codes.

New alpha-relevant client codes include:

```txt
CAATINGA_XDR_BUILD_FAILED
CAATINGA_XDR_PREPARE_FAILED
CAATINGA_XDR_SIGN_FAILED
CAATINGA_XDR_SUBMIT_FAILED
CAATINGA_XDR_RESULT_FAILED
CAATINGA_BINDING_CLIENT_NOT_FOUND
CAATINGA_BINDING_METHOD_NOT_FOUND
CAATINGA_WALLET_NOT_CONNECTED
CAATINGA_CONTRACT_ARTIFACT_NOT_FOUND
```

### Release Gates

The alpha cannot be tagged until these pass from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

The release also requires a local template smoke check:

```txt
1. Generate or inspect the counter template.
2. Confirm template config uses wasm32v1-none.
3. Confirm docs describe init -> build -> deploy -> generate -> invoke.
4. Confirm docs describe how @caatinga/client connects artifacts, generated bindings, and Freighter.
5. Confirm no default test requires testnet or Freighter.
```

## Observability Plan

Default CI remains deterministic:

- typecheck for all workspace packages;
- build for all workspace packages;
- unit tests for core, cli, and client;
- no testnet dependency;
- no wallet dependency.

Release confidence comes from:

- documented `CAATINGA_*` errors;
- Stellar CLI output fixtures for parser-sensitive behavior;
- unit tests for client artifact resolution, binding adapter, XDR debug gating, and wallet signing;
- manual smoke checklist for the generated counter flow.

The release notes must state which checks were automated and which were manual.

## Rollout + Rollback

### Rollout

1. Finish code/docs changes for the alpha gate.
2. Run full verification commands.
3. Commit the alpha changes in coherent commits.
4. Create release notes for `v0.1.0-alpha`.
5. Tag the repository with `v0.1.0-alpha`.

### Rollback

If a blocking issue is found before tagging:

- do not create the tag;
- fix the issue or explicitly remove that surface from the alpha scope;
- rerun the release gates.

If a blocking issue is found after tagging:

- leave the tag immutable;
- document the issue;
- cut a follow-up `v0.1.1-alpha` or `v0.1.0-alpha.1` tag after the fix.

Do not rewrite an already shared release tag.

## Implementation Scope

The implementation plan should focus on:

1. release readiness audit;
2. template/client smoke path;
3. docs alignment;
4. release notes;
5. final verification and tag preparation.

It must not add `doctor`, CLI XDR, `generate --interop`, React hooks, or npm publishing.

## Acceptance Criteria

```txt
1. @caatinga/client is included in the alpha scope.
2. README links CLI, client, config, templates, errors, and testing docs.
3. docs/client.md documents counter usage with generated bindings, artifacts, and Freighter.
4. docs/errors.md documents every public CaatingaErrorCode.
5. react-vite-counter remains compatible with the alpha workflow.
6. No default CI step requires testnet, Freighter, or secret keys.
7. pnpm install --frozen-lockfile passes.
8. pnpm typecheck passes.
9. pnpm build passes.
10. pnpm test passes.
11. Release notes identify automated checks and manual smoke checks.
12. The release tag is not created until the working tree is intentionally committed or otherwise made auditable.
```

## Open Questions

The only open release-management decision is whether the final tag should be exactly `v0.1.0-alpha` or a semver prerelease form such as `v0.1.0-alpha.0`.

Recommendation: use `v0.1.0-alpha` for the first internal checkpoint unless package publishing automation later requires numeric prerelease identifiers.
