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

  if [[ ! -d "$extract_dir/.config" ]]; then
    echo "Decoded CAATINGA_CI_STELLAR_CONFIG_B64 archive must contain a .config/ directory." >&2
    exit 1
  fi

  cp -R "$extract_dir/.config/." "$config_root/"
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

if [[ -d "${config_root}/soroban/identity" ]]; then
  find "${config_root}/soroban/identity" -type f -name '*.toml' -exec chmod 600 {} +
fi
