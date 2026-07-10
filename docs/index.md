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
    details: Install, scaffold, and run the CLI loop. Pin an exact npm version for reproducible installs.
    link: /getting-started
    linkText: Getting started
  - title: Template dApp
    details: Vite + React scaffold with wallet stubs and bindings placeholder.
    link: /tutorials/template-project
  - title: Minimal / CLI-first
    details: Soroban contract and CLI workflow only — add your own UI stack later with @caatinga/client.
    link: /tutorials/minimal-project
  - title: ZK workflow
    details: Circom + Groth16 verifier on Soroban. Use zk-starter for an end-to-end demo with UI.
    link: /tutorials/zk-project
  - title: Command reference
    details: The whole Caatinga loop on one page — init, build, deploy, generate, status.
    link: /cheatsheet
    linkText: Cheatsheet
  - title: LLM / agent primer
    details: Start at /llms.txt for identity, workflow, boundaries, and doc routing.
    link: https://github.com/Dione-b/caatinga/blob/main/llms.txt
    linkText: llms.txt
---

::: info v1.0 stable contract
Caatinga v1.0 is a **contract milestone** on npm major `3.x`. Pin an exact version for reproducible installs. See [Public API](/public-api) and [Troubleshooting](/troubleshooting).
:::

**Start here:** [Getting started](/getting-started) — install, scaffold, and the CLI-to-browser loop.

**Optional walkthrough:** [From Zero to Testnet](/tutorials/from-zero-to-testnet) — deploy and invoke a counter on testnet after the basics.

**Stuck?** Run `caatinga doctor` and check [Errors](/errors) for `CAATINGA_*` codes.

**Coding agents:** read [`llms.txt`](https://github.com/Dione-b/caatinga/blob/main/llms.txt) first. Detailed reference: [for-llms](/for-llms) or [`llms-full.txt`](https://github.com/Dione-b/caatinga/blob/main/llms-full.txt).
