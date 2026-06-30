---
layout: home

hero:
  name: Caatinga
  text: Soroban deploy artifacts + TypeScript CLI
  tagline: Git-versioned deployment state, multi-contract orchestration, npm-first workflow.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: From Zero to Testnet
      link: /tutorials/from-zero-to-testnet
    - theme: alt
      text: GitHub
      link: https://github.com/Dione-b/caatinga

features:
  - title: Quick start
    details: Scaffold with npx, install dependencies, verify with doctor on testnet. Pin @next or an exact version for reproducible installs.
    link: /getting-started
    linkText: Full guide
  - title: Template dApp
    details: Vite + React scaffold with wallet stubs and bindings placeholder. See the Template project guide.
    link: /tutorials/template-project
  - title: Minimal / CLI-first
    details: Soroban contract and CLI workflow only — add your own UI stack later with @caatinga/client.
    link: /tutorials/minimal-project
  - title: ZK workflow
    details: Circom + Groth16 verifier on Soroban. Use zk-starter for an end-to-end demo with UI.
    link: /tutorials/zk-project
  - title: stellar-build integration
    details: Drive the Caatinga lifecycle from Claude Code or Codex with stellar-build agents. Optional — see the Integration guide.
    link: /tutorials/integration-guide
    linkText: Integration guide
---

::: warning Alpha software
Caatinga is pre-1.0. Formats and APIs may change. Install with `npx caatinga@next` or pin an exact version.
:::

**Recommended path for new users:** [From Zero to Testnet](/tutorials/from-zero-to-testnet) — scaffold, deploy, and invoke a counter on testnet.

**Stuck?** Run `caatinga doctor` and check [Errors](/errors) for `CAATINGA_*` codes.
