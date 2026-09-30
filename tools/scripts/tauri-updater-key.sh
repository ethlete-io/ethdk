#!/usr/bin/env bash
# Creates the key pair the Timetrack and Studio update bundles are signed with, and stores the
# private key as the GitHub secrets TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD.
# Put the printed public key into `plugins.updater.pubkey` of both tauri.conf.json files.
#
# Run it once. An installed app accepts only updates signed with the key its own config names, so a
# new key makes every installed copy refuse updates until it is reinstalled by hand.
set -euo pipefail

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PASSWORD="$(openssl rand -hex 24)"

yarn tauri signer generate --ci --write-keys "$WORK/updater.key" --password "$PASSWORD" >/dev/null

gh secret set TAURI_SIGNING_PRIVATE_KEY < "$WORK/updater.key"
printf '%s' "$PASSWORD" | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD

echo "Stored TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD. Public key:"
cat "$WORK/updater.key.pub"
echo
