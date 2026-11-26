#!/usr/bin/env bash
# Usage: remote-guard.sh <slot> -- <command...>, or source it and call rr_guard <slot> <command...>.
# Runs the command in its own process group and writes a NUL byte to stdout every RR_HEARTBEAT_S seconds.
# A dropped ssh session turns that write into an error: the guard then kills the group and removes the slot's
# containers, so a killed local remote-run leaves nothing behind. remote-run.mjs strips the NUL bytes.

rr_remove_containers() {
  command -v docker >/dev/null 2>&1 || return 0
  local ids
  ids=$(docker ps -aq --filter "label=ethlete-rr-slot=$1" 2>/dev/null)
  [ -z "$ids" ] || docker rm -f $ids >/dev/null 2>&1
}

rr_guard() {
  local slot=$1 job beat code
  shift
  trap '' PIPE
  set -m
  "$@" &
  job=$!
  (
    while sleep "${RR_HEARTBEAT_S:-2}"; do
      printf '\0' 2>/dev/null && continue
      trap '' TERM
      kill -TERM -- "-$job" 2>/dev/null
      rr_remove_containers "$slot"
      sleep "${RR_GRACE_S:-5}"
      kill -KILL -- "-$job" 2>/dev/null
      rr_remove_containers "$slot"
      exit 0
    done
  ) &
  beat=$!
  set +m
  wait "$job"
  code=$?
  kill -- "-$beat" 2>/dev/null
  return $code
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  [ "$#" -ge 3 ] && [ "$2" = "--" ] || { echo "usage: remote-guard.sh <slot> -- <command...>" >&2; exit 2; }
  slot=$1
  shift 2
  rr_guard "$slot" "$@"
fi
