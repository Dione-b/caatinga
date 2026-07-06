---
layout: home

hero:
  name: Caatinga
  text: Deployment Orchestration + Versioned Artifacts for Soroban
  tagline: Local, graph-aware deployment orchestration and portable, Git-versioned artifacts for TypeScript teams.
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
    details: Scaffold with npx, install dependencies, verify with doctor on testnet. Pin an exact version for reproducible installs.
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
  - title: LLM / agent primer
    details: Start at /llms.txt for identity, workflow, boundaries, and doc routing. Full API reference at /llms-full.txt.
    link: https://github.com/Dione-b/caatinga/blob/main/llms.txt
    linkText: llms.txt
---

::: info v1.0 stable contract
Caatinga v1.0 is a **contract milestone** on npm major `3.x`. Pin an exact version for reproducible installs. See [Public API](/public-api) and [Troubleshooting](/troubleshooting).
:::

**Recommended path for new users:** [From Zero to Testnet](/tutorials/from-zero-to-testnet) — scaffold, deploy, and invoke a counter on testnet.

**Stuck?** Run `caatinga doctor` and check [Errors](/errors) for `CAATINGA_*` codes.

**Coding agents:** read [`llms.txt`](https://github.com/Dione-b/caatinga/blob/main/llms.txt) first (identity, mental model, non-goals, preferred guidance). Detailed reference: [for-llms](/for-llms) or [`llms-full.txt`](https://github.com/Dione-b/caatinga/blob/main/llms-full.txt).
