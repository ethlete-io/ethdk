#!/usr/bin/env bash
# Usage (inside the rack's WSL distro): rack-docker-run.sh <sha> <slot> -- <suite command>
# Checks <sha> out of the Windows-side mirror into ~/rack-linux/<slot> (ext4) and runs the suite in the
# Playwright image CI pins, so tank, rack and CI render the same pixels.
set -euo pipefail

image="${RACK_PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f}"
mirror="${RACK_MIRROR:-/mnt/c/Users/trbor/ethlete-mirror.git}"

[ "$#" -ge 4 ] && [ "$3" = "--" ] || { echo "usage: rack-docker-run.sh <sha> <slot> -- <suite command>" >&2; exit 2; }
sha="$1" slot="$2"
shift 3

work="$HOME/rack-linux/$slot"
if [ ! -d "$work/.git" ]; then
  mkdir -p "$work"
  git -C "$work" init --quiet
fi
git -C "$work" fetch --quiet --force "$mirror" "$sha"
git -C "$work" checkout --quiet --force --detach FETCH_HEAD
git -C "$work" clean -fdxq -e node_modules -e .yarn/cache

docker image inspect "$image" >/dev/null 2>&1 || docker pull --quiet "$image"

exec docker run --rm --init --ipc=host \
  --add-host=host.docker.internal:host-gateway \
  -v "$work:/work" -w /work \
  -v "rack-linux-yarn-$slot:/root/.yarn/berry" \
  -e CI=1 -e NX_NO_CLOUD=true -e NX_DAEMON=false \
  "$image" bash -lc 'corepack enable && yarn install --immutable >/tmp/yarn-install.log 2>&1 || { tail -40 /tmp/yarn-install.log; exit 1; }; '"$*"
