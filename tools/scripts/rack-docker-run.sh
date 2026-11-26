#!/usr/bin/env bash
# Usage (inside the rack's WSL distro): rack-docker-run.sh <sha> <slot> -- <suite command>
# Checks <sha> out of the Windows-side mirror into ~/rack-linux/<slot> (ext4) and runs the suite in the
# Playwright image CI pins, so tank, rack and CI render the same pixels. The container runs as the distro user, so
# the checkout stays writable for the next fetch.
set -euo pipefail

image="${RACK_PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f}"
mirror="${RACK_MIRROR:-/mnt/c/Users/trbor/ethlete-mirror.git}"

[ "$#" -ge 4 ] && [ "$3" = "--" ] || { echo "usage: rack-docker-run.sh <sha> <slot> -- <suite command>" >&2; exit 2; }
sha="$1" slot="$2"
shift 3

mkdir -p "$HOME/rack-linux"
# A second run in the same slot would re-checkout the tree under the first one's running container.
exec 9>"$HOME/rack-linux/$slot.lock"
flock 9
# A container a killed run left behind still writes to the slot checkout.
leftover=$(docker ps -aq --filter "label=ethlete-rr-slot=$slot")
[ -z "$leftover" ] || docker rm -f $leftover >/dev/null

work="$HOME/rack-linux/$slot"
if [ ! -d "$work/.git" ]; then
  mkdir -p "$work"
  git -C "$work" init --quiet
fi
# Git reads a pack on /mnt/c through 9p at ~150 objects/s; a plain copy reads it at disk speed.
local_mirror="$HOME/rack-linux/mirror.git"
[ -d "$local_mirror" ] || git init --quiet --bare "$local_mirror"
# Git writes commit-graph files read-only, so cp -u cannot replace a changed one in place.
cp -ru --remove-destination "$mirror/objects/." "$local_mirror/objects/"
git -C "$work" fetch --quiet --force --depth 2 "$local_mirror" "$sha"
git -C "$work" checkout --quiet --force --detach FETCH_HEAD
git -C "$work" clean -fdxq -e node_modules -e .yarn/cache -e target

docker image inspect "$image" >/dev/null 2>&1 || docker pull --quiet "$image"
# The CI image has no C linker or Rust; Studio e2e builds its design host with cargo. The tag follows the base
# digest, so a new pin builds a new image.
build_image="rack-linux-ci:${image##*sha256:}"
build_image="${build_image:0:32}"
docker image inspect "$build_image" >/dev/null 2>&1 || docker build --quiet -t "$build_image" - >/dev/null <<DOCKERFILE
FROM $image
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends build-essential pkg-config >/dev/null && rm -rf /var/lib/apt/lists/*
ENV CARGO_HOME=/usr/local/cargo RUSTUP_HOME=/usr/local/rustup PATH=/usr/local/cargo/bin:\$PATH
RUN curl -sSf https://sh.rustup.rs | sh -s -- -y --quiet --profile minimal --no-modify-path && chmod -R a+rwX /usr/local/cargo /usr/local/rustup
DOCKERFILE

cache="$HOME/rack-linux/.cache"
mkdir -p "$cache/yarn-$slot" "$cache/tools" "$cache/cargo-registry"

exec docker run --rm --init --ipc=host --label "ethlete-rr-slot=$slot" \
  --user "$(id -u):$(id -g)" -e HOME=/home/ubuntu \
  --add-host=host.docker.internal:host-gateway \
  -v "$work:/work" -w /work \
  -v "$cache/yarn-$slot:/home/ubuntu/.yarn/berry" -v "$cache/tools:/opt/tools" -v "$cache/cargo-registry:/usr/local/cargo/registry" \
  -e CI=1 -e NX_NO_CLOUD=true -e NX_DAEMON=false -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -e COREPACK_HOME=/opt/tools/corepack \
  "$build_image" bash -c '
[ -x /opt/tools/bin/corepack ] || npm install --global --silent --prefix /opt/tools corepack >/dev/null || exit 1
export PATH=/opt/tools/bin:$PATH
corepack enable --install-directory /opt/tools/bin || exit 1
started=$SECONDS
yarn install --immutable >/tmp/yarn-install.log 2>&1 || { tail -40 /tmp/yarn-install.log; exit 1; }
echo "[rack-linux] install $((SECONDS - started))s"
started=$SECONDS
'"$*"'
code=$?
echo "[rack-linux] suite exit $code after $((SECONDS - started))s"
exit $code'
