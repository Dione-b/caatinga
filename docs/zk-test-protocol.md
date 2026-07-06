# Zero Knowledge Test Protocol (Sprint 46)

Adapted multi-agent protocol replacing external developer sessions. Goal: validate README + `npm install` path without monorepo context.

## Participants

Run **3–5 independent agent sessions** with:

- No access to the Caatinga monorepo
- Only: GitHub README (or docs site), `npm install @caatinga/cli`
- Prompt: _"Install Caatinga and complete your first testnet deploy. Do not ask for help."_

## Record per session

| Field                | Example                                |
| -------------------- | -------------------------------------- |
| Agent ID             | agent-1                                |
| Start time           | 2026-07-06T14:00Z                      |
| Stuck at step        | `caatinga deploy` — missing `--source` |
| First error code     | `CAATINGA_SOURCE_ACCOUNT_REQUIRED`     |
| Time to first deploy | 42 min                                 |
| Questions asked      | "What is alice?"                       |

## Consolidation

Merge results into [`zk-test-results.md`](./zk-test-results.md).

## Allowed fixes after test

- README / getting-started / troubleshooting
- CLI help text and hints
- Template defaults

**Not allowed:** new features, core API changes.

## Limitations

Multi-agent runs do not capture OS-specific friction or emotional drop-off. Complement with one manual run on a clean Linux VM when possible.
