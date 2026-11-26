#!/usr/bin/env bash
# Creates the self-signed code-signing identity the release bundles of Timetrack and Studio are signed
# with, and stores it as the GitHub secrets MACOS_SIGNING_CERTIFICATE and
# MACOS_SIGNING_CERTIFICATE_PASSWORD. Run it once; running it again replaces the identity, and every
# keychain item then asks for the login password once more.
#
# The identity must stay the same across releases: a keychain item's "Always Allow" names the
# certificate, so a new one makes macOS ask again for every item.
set -euo pipefail

NAME="Ethlete Release Signing"

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

PASSWORD="$(openssl rand -hex 24)"

# macOS `security` cannot read OpenSSL 3's default PKCS#12 algorithms.
openssl pkcs12 -export -inkey "$WORK/key.pem" -in "$WORK/cert.pem" -name "$NAME" \
  -out "$WORK/identity.p12" -passout "pass:$PASSWORD" \
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 2>/dev/null

base64 < "$WORK/identity.p12" | tr -d '\n' | gh secret set MACOS_SIGNING_CERTIFICATE
printf '%s' "$PASSWORD" | gh secret set MACOS_SIGNING_CERTIFICATE_PASSWORD

echo "Stored \"$NAME\" as MACOS_SIGNING_CERTIFICATE and MACOS_SIGNING_CERTIFICATE_PASSWORD."
