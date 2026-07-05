# Edge Gaps Resolution

> Resolves GAP-01 through GAP-10 from `CAATINGA_EDGE_GAPS.md`.

**Date:** 2026-07-04  
**Status:** In progress

## Overview

Structural postDeploy expects, smoke/read parity, Address alias resolution, doctor strict checks, regression pipeline, CI testnet, and multi-network scaffold.

## Changes

| Gap    | Solution                                                      |
| ------ | ------------------------------------------------------------- |
| GAP-01 | Expect DSL with structural matchers; postDeployRead vs invoke |
| GAP-02 | Shared verifyExpect; `read --expect`; `caatinga smoke`        |
| GAP-03 | resolveMethodArgs for CLI alias → Address                     |
| GAP-04 | `deploy --if-changed`; `caatinga regression`; CI deploy job   |
| GAP-05 | Doctor env vs artifacts; `--strict-env`                       |
| GAP-06 | Exit codes for stale bindings in status/doctor                |
| GAP-07 | `read --quiet/--summary`; ephemeral ID guide                  |
| GAP-08 | App boundary docs and checklist                               |
| GAP-09 | `caatinga ci`; identity export/import                         |
| GAP-10 | Multi-network scaffold; `doctor --all-networks`               |
