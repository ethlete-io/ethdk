#!/usr/bin/env bash
# usage: sandbox.sh <target-dir> -- <command...>      e.g. sandbox.sh ~/dev/tomflix-clean -- claude
# env: SANDBOX_ALLOW_HOSTS=host,host,...  HTTPS hosts (port 443) the sandbox may reach through the proxy
set -euo pipefail

die() { echo "sandbox: $*" >&2; exit 1; }
[ $# -ge 3 ] && [ "$2" = "--" ] || die "usage: sandbox.sh <target-dir> -- <command...>"
target=$(cd "$1" && pwd)
shift 2

real_home=$HOME
node_root=$(dirname "$(dirname "$(readlink -f "$(command -v node)")")")
claude_real=$(readlink -f "${CLAUDE_BIN:-$real_home/.local/bin/claude}")
home=$(dirname "$target")/$(basename "$target")-home
config=$home/.claude
mkdir -p "$config" "$home/.cache/node" "$home/.proxy"
allow=${SANDBOX_ALLOW_HOSTS:-api.anthropic.com,statsig.anthropic.com,registry.npmjs.org,registry.yarnpkg.com,repo.yarnpkg.com}
here=$(dirname "$(readlink -f "$0")")
cp "$here/proxy-forward.mjs" "$home/.proxy/forward.mjs"
proxy_port=3128
proxy_url=http://127.0.0.1:$proxy_port

[ ! -f "$real_home/.claude/.credentials.json" ] || install -m 600 "$real_home/.claude/.credentials.json" "$config/.credentials.json"
[ -e "$config/.claude.json" ] || echo '{"hasCompletedOnboarding":true}' > "$config/.claude.json"
[ -d "$home/.cache/node/corepack" ] || cp -a "$real_home/.cache/node/corepack" "$home/.cache/node/corepack"

settings=$config/settings.json
cat > "$settings" <<'JSON'
{
  "permissions": {
    "deny": ["WebFetch", "WebSearch", "Bash(curl:*)", "Bash(wget:*)", "Bash(gh:*)", "Bash(git clone:*)",
      "Bash(git fetch:*)", "Bash(git pull:*)", "Bash(git ls-remote:*)", "Bash(git remote add:*)"]
  }
}
JSON

args=(
  --die-with-parent --new-session --unshare-net --unshare-pid --unshare-ipc --unshare-uts --unshare-cgroup-try
  --ro-bind /usr /usr --symlink usr/bin /bin --symlink usr/sbin /sbin --symlink usr/lib /lib --symlink usr/lib64 /lib64
  --ro-bind /etc /etc --ro-bind /run/systemd/resolve /run/systemd/resolve
  --proc /proc --dev /dev --tmpfs /tmp --tmpfs /var/tmp
  --ro-bind "$node_root" "$node_root"
  --ro-bind "$(dirname "$claude_real")" "$(dirname "$claude_real")"
  --symlink "$claude_real" /opt/bin/claude
  --bind "$home" "$home"
  --bind "$target" "$target"
  --ro-bind "$target/node_modules" "$target/node_modules"
  --chdir "$target"
  --clearenv
  --setenv HOME "$home" --setenv CLAUDE_CONFIG_DIR "$config" --setenv COREPACK_HOME "$home/.cache/node/corepack"
  --setenv PATH "$node_root/bin:/opt/bin:/usr/bin" --setenv TERM "${TERM:-xterm-256color}" --setenv LANG "${LANG:-C.UTF-8}"
  --setenv HTTPS_PROXY "$proxy_url" --setenv HTTP_PROXY "$proxy_url" --setenv https_proxy "$proxy_url" --setenv http_proxy "$proxy_url"
  --setenv NO_PROXY localhost,127.0.0.1 --setenv no_proxy localhost,127.0.0.1 --setenv NODE_USE_ENV_PROXY 1 --setenv YARN_HTTP_PROXY "$proxy_url" --setenv YARN_HTTPS_PROXY "$proxy_url"
  --setenv CLEAN_SLATE_SANDBOX 1 --setenv NX_NO_CLOUD true --setenv NX_DAEMON false --setenv COREPACK_ENABLE_DOWNLOAD_PROMPT 0
)

rm -f "$home/.proxy/proxy.sock"
node "$here/proxy-host.mjs" "$home/.proxy/proxy.sock" "$home/.proxy/refused.log" "$allow" &
proxy_pid=$!
trap 'kill "$proxy_pid" 2>/dev/null || true; rm -f "$config/.credentials.json"' EXIT
for _ in $(seq 50); do [ -S "$home/.proxy/proxy.sock" ] && break; sleep 0.1; done
[ -S "$home/.proxy/proxy.sock" ] || die "proxy did not start"

inner='node "$HOME/.proxy/forward.mjs" "$HOME/.proxy/proxy.sock" '$proxy_port' &
for _ in $(seq 50); do (exec 3<>/dev/tcp/127.0.0.1/'$proxy_port') 2>/dev/null && break; sleep 0.1; done
exec "$@"'

set +e
bwrap "${args[@]}" bash -c "$inner" sandbox "$@"
exit $?
