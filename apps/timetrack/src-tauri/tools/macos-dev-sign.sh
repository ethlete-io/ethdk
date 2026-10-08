#!/usr/bin/env bash
# Signs a Timetrack dev build - the bare binary or a `.app` - with the identity `macos-dev-identity.sh`
# creates. Keychain "Always Allow" and privacy permissions are bound to the designated requirement,
# which this makes the same for every build.
set -euo pipefail
. "$(dirname "$0")/macos-dev-signing.env.sh"

if [ ! -f "$PASSWORD_FILE" ]; then
  echo "timetrack: no dev signing identity; run apps/timetrack/src-tauri/tools/macos-dev-identity.sh once" >&2
  exit 1
fi

security unlock-keychain -p "$(cat "$PASSWORD_FILE")" "$KEYCHAIN"
# By hash: an older identity of the same name may still sit in the login keychain.
HASH="$(security find-identity -p codesigning "$KEYCHAIN" | awk -v name="\"$NAME\"" 'index($0, name) { print $2; exit }')"
if ! output="$(codesign --force --sign "$HASH" --keychain "$KEYCHAIN" --identifier "$IDENTIFIER" "$1" 2>&1)"; then
  echo "$output" >&2
  exit 1
fi
