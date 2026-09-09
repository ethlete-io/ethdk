#!/usr/bin/env bash
# Creates the self-signed code-signing identity that `sign-and-run.sh` signs dev builds with, and
# imports it into the login keychain. Run it once per machine.
#
# Without a signing identity the dev binary is unsigned, and a keychain item's ACL cannot name it in a
# way that survives a rebuild - so macOS asks for the login password again after every `cargo` build,
# even after "Always Allow". A certificate gives the binary a designated requirement that names the
# certificate rather than the file's hash, which is what makes the grant stick.
set -euo pipefail

NAME="Timetrack Dev Signing"
IDENTIFIER="io.ethlete.timetrack"

if security find-identity -p codesigning | grep -qF "$NAME"; then
  echo "The identity \"$NAME\" is already in the login keychain."
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

# macOS `security` cannot read OpenSSL 3's default PKCS#12 algorithms, so the bundle is written with
# the older ones it does read.
openssl pkcs12 -export -inkey "$WORK/key.pem" -in "$WORK/cert.pem" -name "$NAME" \
  -out "$WORK/identity.p12" -passout pass:timetrack \
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 2>/dev/null

# `-T /usr/bin/codesign -A` puts codesign in the private key's ACL, so signing a build never asks for
# the login password either.
security import "$WORK/identity.p12" -k "$HOME/Library/Keychains/login.keychain-db" \
  -P timetrack -T /usr/bin/codesign -A

echo
echo "Imported \"$NAME\"."
echo "The next \`cargo\` build signs the binary with it as \"$IDENTIFIER\"."
echo "Answer \"Always Allow\" once per keychain item after that, and it holds."
