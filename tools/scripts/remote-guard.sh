#!/usr/bin/env bash
# Usage: remote-guard.sh <slot> -- <command...>, or source it and call rr_guard <slot> <command...>.
# Runs the command in its own process group and writes a NUL byte to stdout every RR_HEARTBEAT_S seconds.
# A dropped ssh session turns that write into an error: the guard then kills the group and removes the slot's
# containers, so a killed local remote-run leaves nothing behind. remote-run.mjs strips the NUL bytes.
# One guard per slot at a time: a second one waits on the slot's lock file, which dies with the process.

rr_remove_containers() {
  command -v docker >/dev/null 2>&1 || return 0
  local ids
  ids=$(docker ps -aq --filter "label=ethlete-rr-slot=$1" 2>/dev/null)
  [ -z "$ids" ] || docker rm -f $ids >/dev/null 2>&1
}

# Usage: rr_fetch <dir> <tar> <path>... packs the paths that exist under <dir>; missing ones are reported, not fatal.
rr_fetch() {
  local dir=$1 tar=$2 path keep=()
  shift 2
  for path in "$@"; do
    if [ -e "$dir/$path" ]; then keep+=("$path"); else echo "[remote-run] fetch: missing $path"; fi
  done
  [ "${#keep[@]}" -gt 0 ] || return 0
  tar -C "$dir" -cf "$tar" "${keep[@]}" && echo "[remote-run] fetch: packed ${keep[*]}"
  return 0
}

# Usage: rr_lfs <work> <store> <list> replaces the Git LFS pointer files of a checkout with the objects in <store>;
# each <list> line is "<oid> <path>".
rr_lfs() {
  local work=$1 store=$2 list=$3 oid path n=0
  while IFS=' ' read -r oid path; do
    [ -f "$store/$oid" ] || continue
    cp -f "$store/$oid" "$work/$path" && n=$((n + 1))
  done <"$list"
  echo "[remote-run] lfs: $n files"
}

rr_lock() {
  local file="${RR_LOCK_DIR:-$HOME/ethlete-rr/locks}/$1.lock"
  mkdir -p "${file%/*}"
  exec 9>"$file" || return 1
  if command -v flock >/dev/null 2>&1; then
    flock -n 9 && return 0
    echo "[remote-run] slot $1 busy, waiting"
    flock 9
    return
  fi
  local dir="$file.d" waited=0
  until mkdir "$dir" 2>/dev/null; do
    if [ -f "$dir/pid" ] && ! kill -0 "$(cat "$dir/pid")" 2>/dev/null; then
      rm -rf "$dir"
      continue
    fi
    [ "$waited" -eq 0 ] && echo "[remote-run] slot $1 busy, waiting"
    waited=1
    sleep 1
  done
  echo $$ >"$dir/pid"
  RR_LOCK_DIR_HELD=$dir
}

rr_unlock() {
  exec 9>&-
  [ -z "${RR_LOCK_DIR_HELD:-}" ] || rm -rf "$RR_LOCK_DIR_HELD"
  RR_LOCK_DIR_HELD=
}

rr_guard() {
  local slot=$1 job beat code
  shift
  rr_lock "$slot" || return 1
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
  rr_unlock
  return $code
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  [ "$#" -ge 3 ] && [ "$2" = "--" ] || { echo "usage: remote-guard.sh <slot> -- <command...>" >&2; exit 2; }
  slot=$1
  shift 2
  rr_guard "$slot" "$@"
fi
