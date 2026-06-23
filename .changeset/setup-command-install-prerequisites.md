---
"@caatinga/cli": minor
---

Add `caatinga setup`: a one-step bootstrap that installs the prerequisites for Stellar/Soroban development on a fresh machine and creates a funded local identity.

It runs five idempotent steps — Node.js check, Rust toolchain (install/update via `rustup`), `wasm32v1-none` target, Stellar CLI, and a local identity — installing only what is missing. Notable behavior:

- **Stellar CLI is version-pinned** to the last-tested release (`cargo install --locked stellar-cli --version <pinned>`). An already-installed CLI below the supported minimum is reinstalled at the pinned version, so `caatinga doctor` never reports an untested or unsupported version afterward.
- **Identity funding is network-aware:** `--fund` is only used on fundable networks (`testnet`, `futurenet`, `local`, `standalone`). On other networks (e.g. `mainnet`) the identity is created without funding, with guidance to fund it manually.
- **Windows-aware:** Rust auto-install (the Unix-only `rustup` `curl | sh` flow) is skipped on Windows in favor of manual `winget`/`rustup-init.exe` instructions.
- **Clearer failures and follow-ups:** a failed Stellar CLI build from source prints per-platform build dependencies plus a `cargo binstall`/prebuilt-binary alternative, and the summary reminds you to restart your shell (or `source "$HOME/.cargo/env"`) when tools were freshly installed.
- The summary no longer claims "all prerequisites satisfied" when steps were skipped via `--skip-rust`/`--skip-stellar`/`--skip-identity`.
