#!/usr/bin/env bash
# Creates the self-signed code-signing identity `macos-dev-sign.sh` signs dev builds with, in a keychain
# of its own whose password lives in a file. Run it once per machine; it needs no login password and
# works over SSH. Running it again keeps the identity: a new one makes every keychain item and privacy
# permission ask once more.
set -euo pipefail
. "$(dirname "$0")/macos-dev-signing.env.sh"

if [ -f "$KEYCHAIN" ]; then
  if [ ! -f "$PASSWORD_FILE" ]; then
    echo "$KEYCHAIN exists but $PASSWORD_FILE does not. Delete the keychain and run this again." >&2
    exit 1
  fi
  security unlock-keychain -p "$(cat "$PASSWORD_FILE")" "$KEYCHAIN"
  if security find-identity -p codesigning "$KEYCHAIN" | grep -qF "\"$NAME\""; then
    HAS_IDENTITY=1
  fi
else
  mkdir -p "$(dirname "$PASSWORD_FILE")"
  (umask 077 && openssl rand -hex 24 > "$PASSWORD_FILE")
  security create-keychain -p "$(cat "$PASSWORD_FILE")" "$KEYCHAIN"
  security set-keychain-settings "$KEYCHAIN"
  security unlock-keychain -p "$(cat "$PASSWORD_FILE")" "$KEYCHAIN"
fi

# codesign builds the certificate chain from the search list, so the keychain has to be on it.
keychains=()
while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line#\"}"
  keychains+=("${line%\"}")
done < <(security list-keychains -d user)
if [[ " ${keychains[*]} " != *" $KEYCHAIN "* ]]; then
  security list-keychains -d user -s "${keychains[@]}" "$KEYCHAIN"
fi

if [ -n "${HAS_IDENTITY:-}" ]; then
  echo "The identity \"$NAME\" is already in $KEYCHAIN."
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cat > "$WORK/openssl.cnf" <<CNF
[req]
distinguished_name = dn
x509_extensions = v3
prompt = no
[dn]
CN = $NAME
[v3]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
CNF

openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
  -keyout "$WORK/key.pem" -out "$WORK/cert.pem" -config "$WORK/openssl.cnf" 2>/dev/null

# macOS `security` cannot read OpenSSL 3's default PKCS#12 algorithms.
openssl pkcs12 -export -inkey "$WORK/key.pem" -in "$WORK/cert.pem" -name "$NAME" \
  -out "$WORK/identity.p12" -passout pass:timetrack \
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 2>/dev/null

security import "$WORK/identity.p12" -k "$KEYCHAIN" -P timetrack -T /usr/bin/codesign
# Without the partition list codesign asks for the keychain password in a dialog, and fails over SSH.
security set-key-partition-list -S apple-tool:,apple: -s -k "$(cat "$PASSWORD_FILE")" "$KEYCHAIN" >/dev/null

echo "Created \"$NAME\" in $KEYCHAIN."
echo "Every dev build is now signed with it. Answer \"Always Allow\" once per keychain item on the next start."
