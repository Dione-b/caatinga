#!/usr/bin/env bash
set -euo pipefail

: "${CAATINGA_CI_STELLAR_CONFIG_B64:?Set CAATINGA_CI_STELLAR_CONFIG_B64 to a base64-encoded Stellar CLI config payload.}"

target_home="${1:-$HOME}"
config_root="${target_home}/.config"
payload_file="$(mktemp)"
extract_dir="$(mktemp -d)"

cleanup() {
  rm -f "$payload_file"
  rm -rf "$extract_dir"
}
trap cleanup EXIT

mkdir -p "$config_root"
printf "%s" "$CAATINGA_CI_STELLAR_CONFIG_B64" | base64 --decode > "$payload_file"

restore_archive() {
  local archive_flags="$1"
  tar "$archive_flags" "$payload_file" -C "$extract_dir"

  # Layout 1: `.config/stellar` (+ legacy `.config/soroban`), built by hand.
  if [[ -d "$extract_dir/.config" ]]; then
    cp -R "$extract_dir/.config/." "$config_root/"
    return
  fi

  # Layout 2: the contents of the Stellar config directory, as written by `ctg identity export`.
  if [[ -d "$extract_dir/identity" || -f "$extract_dir/config.toml" ]]; then
    mkdir -p "${config_root}/stellar"
    cp -R "$extract_dir/." "${config_root}/stellar/"
    return
  fi

  echo "Decoded CAATINGA_CI_STELLAR_CONFIG_B64 archive must contain a .config/ directory or a Stellar config directory (identity/ or config.toml), as produced by 'ctg identity export'." >&2
  exit 1
}

if tar -tzf "$payload_file" >/dev/null 2>&1; then
  restore_archive -xzf
elif tar -tf "$payload_file" >/dev/null 2>&1; then
  restore_archive -xf
else
  mkdir -p "${config_root}/stellar"
  cp "$payload_file" "${config_root}/stellar/config.toml"
fi

if [[ -f "${config_root}/stellar/config.toml" ]]; then
  chmod 600 "${config_root}/stellar/config.toml"
fi

for identity_dir in "${config_root}/stellar/identity" "${config_root}/soroban/identity"; do
  if [[ -d "$identity_dir" ]]; then
    find "$identity_dir" -type f -name '*.toml' -exec chmod 600 {} +
  fi
done
