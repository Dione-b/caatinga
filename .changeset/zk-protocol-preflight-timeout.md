---
"@caatinga/core": patch
---

The ZK protocol pre-flight (`getNetwork`, used by `ctg deploy <verifier>`, `ctg zk invoke` and `ctg doctor`) now waits up to 20s per attempt instead of 10s and retries once when the request times out, so a slow public testnet RPC no longer shows up as "protocol unknown". RPC error payloads, non-2xx responses and refused connections are not retried, and the check stays advisory when the protocol cannot be determined. `PROTOCOL_VERSION_MAX_ATTEMPTS` is exported alongside `PROTOCOL_VERSION_TIMEOUT_MS`.
