#!/usr/bin/env bash
# Move npm dist-tag `latest` to an already-published @caatinga/* version.
#
# Usage:
#   bash scripts/promote-latest.sh <version> --otp <code>
#
# Example:
#   bash scripts/promote-latest.sh 3.1.2 --otp 123456
set -euo pipefail

VERSION="${1:?Usage: promote-latest.sh <version> --otp <code>}"
shift

OTP=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --otp)
      [[ $# -ge 2 ]] || { echo "--otp requires a value" >&2; exit 2; }
      OTP="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

[[ -n "$OTP" ]] || { echo "npm requires --otp for dist-tag changes on this account" >&2; exit 2; }

for pkg in cli core client zk; do
  echo "Promoting @caatinga/$pkg@$VERSION → latest"
  npm dist-tag add "@caatinga/$pkg@$VERSION" latest --otp="$OTP"
done

echo
for pkg in cli core client zk; do
  echo "@caatinga/$pkg: $(npm view "@caatinga/$pkg" dist-tags --json)"
done
