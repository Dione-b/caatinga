#!/usr/bin/env bash

archive_contains_path() {
  local archive_path="$1"
  local member_path="$2"

  tar -tzf "$archive_path" "$member_path" >/dev/null 2>&1
}
