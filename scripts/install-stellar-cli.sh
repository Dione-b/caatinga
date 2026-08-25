#!/usr/bin/env bash
# Install the Stellar CLI release binary with a resilient download.
#
# The official `stellar/stellar-cli` action only retries the CDN download a
# handful of times over ~25s, which a multi-minute 503 outage from the GitHub
# releases CDN can still blow past (see issue #119). When the binary is not
# already restored from `actions/cache`, this helper performs the same
# download with an exponential backoff that rides out much longer outages.
#
# Usage: install-stellar-cli.sh <version> [os-arch-triple]
#   version           CLI version, with or without a leading "v" (e.g. 27.0.0)
#   os-arch-triple    target triple (default: x86_64-unknown-linux-gnu)
set -euo pipefail

version_raw="${1:?Usage: install-stellar-cli.sh <version> [os-arch-triple]}"
os_arch="${2:-x86_64-unknown-linux-gnu}"

version="${version_raw#v}"
install_dir="$HOME/.local/bin"
mkdir -p "$install_dir"

file="stellar-cli-${version}-${os_arch}.tar.gz"
url="https://github.com/stellar/stellar-cli/releases/download/v${version}/${file}"

# Exponential backoff: 10s, 20s, 40s, 80s, 160s => ~5min of retries.
max_attempts=6
delay=10

attempt=1
until curl -fSL "$url" | tar xz -C "$install_dir"; do
  if (( attempt >= max_attempts )); then
    echo "error: failed to download ${url} after ${max_attempts} attempts" >&2
    exit 1
  fi
  echo "warning: download of ${url} failed (attempt ${attempt}); retrying in ${delay}s" >&2
  sleep "$delay"
  delay=$(( delay * 2 ))
  attempt=$(( attempt + 1 ))
done

binary="${install_dir}/stellar"
"${binary}" --version
