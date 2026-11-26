#!/usr/bin/env bash
# The cargo `runner` for the Apple targets: it signs the binary cargo just built, then runs it.
set -euo pipefail

BINARY="$1"
shift

"$(dirname "$0")/macos-dev-sign.sh" "$BINARY" ||
  echo "timetrack: $BINARY runs unsigned; the keychain will ask for the login password" >&2

exec "$BINARY" "$@"
