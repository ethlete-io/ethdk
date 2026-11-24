#!/usr/bin/env bash
# usage: install-sdk.sh <sdk> <target>
# Replaces the @ethlete packages in <target>/node_modules by the build in <sdk>/dist/libs, so the cli and the libs it checks come from one commit.
set -euo pipefail
sdk=$1 target=$2
for lib in types bracket core query components cli agent-rules; do
  if [ -d "$sdk/dist/libs/$lib" ]; then
    rm -rf "$target/node_modules/@ethlete/$lib"
    mkdir -p "$target/node_modules/@ethlete"
    cp -a "$sdk/dist/libs/$lib" "$target/node_modules/@ethlete/$lib"
  fi
done
