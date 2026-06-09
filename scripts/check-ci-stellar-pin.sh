#!/usr/bin/env bash
set -euo pipefail
grep -Eq '^[[:space:]]*uses:[[:space:]]*stellar/stellar-cli@v25\.2\.0[[:space:]]*$' .github/workflows/ci.yml || {
  echo "ci.yml must install Stellar CLI via stellar/stellar-cli@v25.2.0"
  exit 1
}
