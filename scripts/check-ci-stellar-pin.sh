#!/usr/bin/env bash
set -euo pipefail
grep -Eq '^[[:space:]]*(uses:[[:space:]]*stellar/stellar-cli@v28\.0\.0|run:[[:space:]]*bash scripts/install-stellar-cli\.sh 28\.0\.0)[[:space:]]*$' .github/workflows/ci.yml || {
  echo "ci.yml must install Stellar CLI 28.0.0 (via stellar/stellar-cli@v28.0.0 or scripts/install-stellar-cli.sh 28.0.0)"
  exit 1
}
