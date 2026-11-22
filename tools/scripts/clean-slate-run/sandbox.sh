#!/usr/bin/env bash
# usage: sandbox.sh <target-dir> -- <command...>      e.g. sandbox.sh ~/dev/tomflix-clean -- claude
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
mkdir -p "$config" "$home/.cache/node"

[ -e "$config/.credentials.json" ] || { [ ! -f "$real_home/.claude/.credentials.json" ] || cp "$real_home/.claude/.credentials.json" "$config/.credentials.json"; }
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
  --die-with-parent --new-session --unshare-pid --unshare-ipc --unshare-uts --unshare-cgroup-try
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
  --setenv CLEAN_SLATE_SANDBOX 1 --setenv NX_NO_CLOUD true --setenv NX_DAEMON false --setenv COREPACK_ENABLE_DOWNLOAD_PROMPT 0
)

exec bwrap "${args[@]}" "$@"
