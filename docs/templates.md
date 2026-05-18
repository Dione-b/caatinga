# Templates

The MVP ships official templates:

- `react-vite-counter` — single Soroban counter dApp.
- `marketplace-with-token` — **experimental** two-contract layout demonstrating `dependsOn` and `${contracts.token.contractId}` deploy args.

Every template must include `caatinga.template.json`:

```json
{
  "name": "react-vite-counter",
  "version": "0.1.0",
  "description": "Minimal Vite + React + Soroban counter dApp.",
  "caatinga": {
    "compatibleCore": "^0.2.0",
    "templateVersion": 1
  },
  "frontend": {
    "framework": "vite-react",
    "packageManager": "npm"
  },
  "contracts": {
    "path": "contracts",
    "default": "counter"
  },
  "files": {
    "config": "caatinga.config.ts",
    "artifacts": "caatinga.artifacts.json"
  }
}
```

`compatibleCore` is checked against the current `@caatinga/core` version before files are copied. Official templates in this repository must pin `compatibleCore` to `^<coreVersion>` (the same range `defaultCompatibleCoreRange()` derives from `CAATINGA_CORE_VERSION`); CI enforces that pin so a core bump cannot ship with stale template metadata. Missing manifests fail with `CAATINGA_TEMPLATE_MANIFEST_NOT_FOUND`; invalid manifests fail with `CAATINGA_INVALID_TEMPLATE_MANIFEST`; incompatible manifests fail with `CAATINGA_TEMPLATE_INCOMPATIBLE`.

Official templates are maintained in this repository. Community templates should be treated as executable source code: inspect the files before running install scripts or connecting wallets.

Generated projects include:

- `contracts/counter`
- `src`
- `caatinga.config.ts`
- `caatinga.artifacts.json`
- Vite and TypeScript config
- dependencies for generated bindings, `@caatinga/client`, and Freighter smoke wiring

Set `CAATINGA_TEMPLATES_DIR` during local development to point the CLI at a custom templates directory.

## Alpha smoke path

The official template documents both paths:

1. CLI: `build -> deploy -> generate -> invoke`
2. Browser/client: generated bindings + `caatinga.artifacts.json` + `@caatinga/client` + Freighter adapter

The template does not generate React hooks or `caatinga generate --interop` output in alpha.

Browser-facing templates must alias `@caatinga/core` to a browser-safe shim (see `react-vite-counter/vite.config.ts`). After `@caatinga/core/browser` ships, prefer that entry over local duplicates.
