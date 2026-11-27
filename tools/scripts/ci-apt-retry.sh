#!/usr/bin/env bash
set -u

if [ "$#" -eq 0 ]; then
  echo "usage: ci-apt-retry.sh <command...>" >&2
  exit 2
fi

as_root=(sudo)
# A container job runs as root, and its image has no sudo.
[ "$(id -u)" -eq 0 ] && as_root=()

conf_dir="${ETHLETE_APT_CONF_DIR:-/etc/apt/apt.conf.d}"
echo 'Acquire::Retries "3";' | "${as_root[@]}" tee "$conf_dir/80-ci-retries" >/dev/null

# The runner image ships a Microsoft apt source that currently answers 403 "no longer signed" and fails every apt-get update; no job installs from it.
"${as_root[@]}" rm -f /etc/apt/sources.list.d/microsoft-prod.* /etc/apt/sources.list.d/microsoft*.list /etc/apt/sources.list.d/microsoft*.sources

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

for attempt in 1 2 3; do
  echo "apt try $attempt of 3: $*"
  if { "${as_root[@]}" apt-get update -o Acquire::Retries=3 && "$@"; } 2>&1 | tee "$log" && [ "${PIPESTATUS[0]}" -eq 0 ]; then
    exit 0
  fi
  [ "$attempt" -lt 3 ] && sleep "${ETHLETE_APT_RETRY_DELAY:-5}"
done

detail="$(grep -E '^(E|Err):|Failed to fetch' "$log" | tail -n 5 | tr '\n' ' ')"
echo "::error title=apt failed after 3 tries::${detail:-no E: line in the output; command: $*}"
exit 1
