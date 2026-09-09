#!/usr/bin/env bash
# The cargo `runner` for the Apple targets: it signs the binary cargo just built, then runs it.
#
# The signature is what a keychain item's ACL can name, so "Always Allow" survives the next build. See
# `macos-dev-identity.sh` for the identity, and `src/keychain.rs` for what the prompts cost.
set -euo pipefail

NAME="Timetrack Dev Signing"
BINARY="$1"
shift

if security find-identity -p codesigning | grep -qF "$NAME"; then
  codesign -s "$NAME" -f -i io.ethlete.timetrack "$BINARY" >/dev/null 2>&1 ||
    echo "timetrack: could not sign $BINARY; the keychain will ask for the login password" >&2
else
  echo "timetrack: no \"$NAME\" identity; run tools/macos-dev-identity.sh to stop the keychain prompts" >&2
fi

exec "$BINARY" "$@"
