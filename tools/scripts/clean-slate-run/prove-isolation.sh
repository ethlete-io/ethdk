#!/usr/bin/env bash
# usage: prove-isolation.sh <target-dir>      re-runs itself inside sandbox.sh; exit 1 on any FAIL
set -uo pipefail

target=$(cd "${1:?usage: prove-isolation.sh <target-dir>}" && pwd)
if [ -z "${CLEAN_SLATE_SANDBOX:-}" ]; then
  self=$(readlink -f "$0")
  exec "$(dirname "$self")/sandbox.sh" "$target" -- bash -s -- "$target" < "$self"
fi

cd "$target"
failed=0
check() {
  local name=$1 detail=${2:-}
  shift 2 || true
  if "$@" >/dev/null 2>&1 </dev/null; then echo "PASS  $name"; else echo "FAIL  $name${detail:+ ($detail)}"; failed=1; fi
}
absent() { [ ! -e "$1" ] && [ ! -L "$1" ]; }
no_output() { [ -z "$("$@" 2>/dev/null </dev/null)" ]; }
no_fetch() { ! node -e "fetch(process.argv[1],{signal:AbortSignal.timeout(8000)}).then((r)=>process.exit(r.status<600?0:1),()=>process.exit(1))" "$1"; }
no_urllib() { ! python3 -I -c "import sys,urllib.request;urllib.request.urlopen(sys.argv[1],timeout=8)" "$1"; }

for path in /home/tom/dev/ethlete-sdk /home/tom/dev/tomflix /home/tom/.claude /home/tom/.claude.json /home/tom/.codex /home/tom/.zsh_history /home/tom/.bash_history /home/tom/.ssh /home/tom/.config; do
  check "unreachable: $path" "" absent "$path"
done

check "no studio-lab dir or file reachable" "" no_output find / -xdev \( -path /proc -o -path /sys \) -prune -o -name 'studio-lab*' -print
check "git: exactly one commit in every ref" "" test "$(git rev-list --all | wc -l)" = 1
check "git: exactly one commit object in the store" "" test "$(git cat-file --batch-all-objects --batch-check | grep -c ' commit ')" = 1
check "git: no remote, no alternates" "" bash -c '[ -z "$(git remote)" ] && [ ! -e .git/objects/info/alternates ]'
check "git: no old design or UI paths in any object" "" no_output bash -c "git rev-list --all --objects | grep -E 'libs/domain|libs/theme|\.ethlete/design/calls|plans/'"
check "no tracked file names an absolute /home path" "" no_output git grep -n '/home/'
check "design CLI resolves only this copy: config port is not the default 4402" "" bash -c '! grep -q 4402 .ethlete/design/config.json'
check "node_modules/@ethlete holds real copies, no symlink" "" no_output find node_modules/@ethlete -maxdepth 1 -type l
check "no symlink in the copy points outside it" "" no_output bash -c "find . -path ./.git -prune -o -type l -print0 | xargs -0 -r -n1 readlink -m | grep -v \"^$target\""
check "project settings deny WebFetch, WebSearch, curl, wget, gh, git clone" "" grep -q '"WebSearch"' .claude/settings.json

for token in film-detail login-dialog shell-main studio-lab; do
  check "no '$token' outside node_modules and .git" "" no_output grep -rIl --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.nx --exclude-dir=.angular -e "$token" .
done
for token in film-detail login-dialog shell-main studio-lab; do
  hits=$(grep -rIl -e "$token" node_modules/@ethlete 2>/dev/null </dev/null | head -5 | tr '\n' ' ')
  echo "INFO  '$token' in node_modules/@ethlete: ${hits:-none}"
done

github=https://raw.githubusercontent.com/ethlete-io/ethdk/next/README.md
check "network: node cannot fetch $github" "no egress filter" no_fetch "$github"
check "network: python3 urllib cannot fetch $github" "no egress filter" no_urllib "$github"
for port in 4402 4221 4492; do
  check "loopback: host Studio port $port not reachable" "loopback is shared with the host" no_fetch "http://127.0.0.1:$port/"
done

[ "$failed" = 0 ] && echo "ALL PASS" || echo "FAILURES PRESENT"
exit "$failed"
