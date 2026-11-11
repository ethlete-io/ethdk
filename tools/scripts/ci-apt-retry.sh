#!/usr/bin/env bash
set -u

if [ "$#" -eq 0 ]; then
  echo "usage: ci-apt-retry.sh <command...>" >&2
  exit 2
fi

conf_dir="${ETHLETE_APT_CONF_DIR:-/etc/apt/apt.conf.d}"
echo 'Acquire::Retries "3";' | sudo tee "$conf_dir/80-ci-retries" >/dev/null

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

for attempt in 1 2 3; do
  echo "apt try $attempt of 3: $*"
  if { sudo apt-get update -o Acquire::Retries=3 && "$@"; } 2>&1 | tee "$log" && [ "${PIPESTATUS[0]}" -eq 0 ]; then
    exit 0
  fi
  [ "$attempt" -lt 3 ] && sleep "${ETHLETE_APT_RETRY_DELAY:-5}"
done

detail="$(grep -E '^(E|Err):|Failed to fetch' "$log" | tail -n 5 | tr '\n' ' ')"
echo "::error title=apt failed after 3 tries::${detail:-no E: line in the output; command: $*}"
exit 1
