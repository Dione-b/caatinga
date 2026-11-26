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
#
# The archive is verified against a pinned SHA-256 before it is extracted: these
# workflows also hold testnet identity secrets, so a swapped release asset must
# fail the job, not run. To pin a new version, read the asset's `digest` from
# `gh api repos/stellar/stellar-cli/releases/tags/v<version>` and add it below.
set -euo pipefail

version_raw="${1:?Usage: install-stellar-cli.sh <version> [os-arch-triple]}"
os_arch="${2:-x86_64-unknown-linux-gnu}"

version="${version_raw#v}"
install_dir="$HOME/.local/bin"
mkdir -p "$install_dir"

file="stellar-cli-${version}-${os_arch}.tar.gz"
url="https://github.com/stellar/stellar-cli/releases/download/v${version}/${file}"

case "$file" in
  stellar-cli-28.0.0-x86_64-unknown-linux-gnu.tar.gz)
    expected_sha256="207544486734fccb4df1afc4a7745478f9f1e21688b2f9506f0ef36f60ce3fdc" ;;
  stellar-cli-23.3.0-x86_64-unknown-linux-gnu.tar.gz)
    expected_sha256="b3a5455d7113a53a8bd0f1ba0148a14b7aa7a46ee2f49c3b9277424775b309ad" ;;
  *)
    echo "error: no pinned SHA-256 for ${file}; add it to scripts/install-stellar-cli.sh" >&2
    exit 1 ;;
esac

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

archive_path="${temp_dir}/${file}"

# Exponential backoff: 10s, 20s, 40s, 80s, 160s => ~5min of retries.
max_attempts=6
delay=10

attempt=1
until curl -fSL --retry 0 "$url" -o "$archive_path"; do
  if (( attempt >= max_attempts )); then
    echo "error: failed to download ${url} after ${max_attempts} attempts" >&2
    exit 1
  fi
  echo "warning: download of ${url} failed (attempt ${attempt}); retrying in ${delay}s" >&2
  sleep "$delay"
  delay=$(( delay * 2 ))
  attempt=$(( attempt + 1 ))
done

actual_sha256="$(sha256sum "$archive_path" | cut -d' ' -f1)"
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  echo "error: checksum mismatch for ${file}: expected ${expected_sha256}, got ${actual_sha256}" >&2
  echo "error: treat this as a possible supply-chain compromise, not a flaky download" >&2
  exit 1
fi

tar xzf "$archive_path" -C "$install_dir"
chmod +x "${install_dir}/stellar"

binary="${install_dir}/stellar"
"${binary}" --version
