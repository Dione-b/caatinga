# Error Code Policy

`CAATINGA_*` error codes are public API. Automation may parse `code`; it must not parse message text.

## Semver Rules

- Adding a new CAATINGA\_\* code: minor change
- Removing a CAATINGA\_\* code: major change
- Renaming a CAATINGA\_\* code: major change
- Changing the meaning of a code: major change
- Changing message text only: patch change

## Required Fields

Every documented code must include meaning, likely cause, suggested fix, CI handling recommendation, and semver stability.

## CLI exit behavior

The Caatinga CLI sets `process.exitCode = 1` on failure (including unhandled `program.parseAsync` rejections) and formats failures with `printError`: the `Error:` line uses stderr, while the blank line, `Code:`, and optional `Hint:` use the logger info channel (stdout in the stock CLI). Automation should parse process output for the `Code:` line and must not assume a synchronous `process.exit(1)` — the process may exit non-zero after the event loop drains while still printing the code.
