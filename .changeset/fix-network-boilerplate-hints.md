---
"@caatinga/core": patch
---

Fix the `NETWORK_NOT_FOUND` boilerplate hints emitting an unusable config snippet.

The hand-written snippets used `passphrase:` instead of `networkPassphrase:` (copying them
produced `CAATINGA_INVALID_CONFIG`), gave mainnet a Horizon URL and the wrong network
passphrase ("October 2015" rather than "September 2015"), appended a `:443` port
inconsistent with the rest of the codebase, and suggested a `friendbotUrl` field the config
schema does not accept.

The snippets are now rendered from the typed network config, reusing `WELL_KNOWN_NETWORKS`,
so the emitted keys and values cannot drift from `NetworkConfigSchema` again.
