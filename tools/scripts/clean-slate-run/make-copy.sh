#!/usr/bin/env bash
# usage: make-copy.sh <source-repo> <target-dir> --keep <paths...> [--drop <paths...>] [--overlay <dir>] [--sdk <ethlete-sdk>]
# e.g.:  make-copy.sh ~/dev/tomflix ~/dev/tomflix-clean --keep apps/api libs/types --overlay overlays/tomflix
set -euo pipefail

die() { echo "make-copy: $*" >&2; exit 1; }
[ $# -ge 3 ] || die "usage: make-copy.sh <source-repo> <target-dir> --keep <paths...> [--drop <paths...>] [--overlay <dir>] [--sdk <ethlete-sdk>]"

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source_repo=$(cd "$1" && pwd)
target=$2
shift 2
keep=() drop=() overlay="" sdk=""
mode=""
while [ $# -gt 0 ]; do
  case $1 in
    --keep|--drop) mode=${1#--} ;;
    --overlay) overlay=$(cd "$2" && pwd); shift ;;
    --sdk) sdk=$(cd "$2" && pwd); shift ;;
    *) case $mode in keep) keep+=("$1") ;; drop) drop+=("$1") ;; *) die "unexpected $1" ;; esac ;;
  esac
  shift
done
[ ${#keep[@]} -gt 0 ] || die "--keep needs at least one path"
[ ! -e "$target" ] || die "$target exists"
sdk=${sdk:-$(cd "$here/../../.." && pwd)}
[ -f "$sdk/dist/libs/agent-rules/src/index.js" ] || die "build agent-rules first: $sdk/dist/libs/agent-rules"

mkdir -p "$target"
target=$(cd "$target" && pwd)

git -C "$source_repo" ls-files -z | KEEP="${keep[*]}" DROP="${drop[*]}" node -e '
const split = (v) => (v ?? "").split(" ").filter(Boolean);
const keep = split(process.env.KEEP), drop = split(process.env.DROP);
const under = (p, list) => list.some((d) => p === d || p.startsWith(d + "/"));
const files = require("fs").readFileSync(0, "utf8").split("\0").filter(Boolean);
const wanted = files.filter((p) =>
  (!p.includes("/") || under(p, keep)) && !under(p, drop) && !/(^|\/)(__pycache__|\.ruff_cache)\//.test(p) && !p.endsWith(".pyc"));
process.stdout.write(wanted.join("\0") + "\0");
' | tar -C "$source_repo" --null -T - -cf - | tar -C "$target" -xf -

[ -z "$overlay" ] || cp -a "$overlay"/. "$target"/

cd "$target"
node -e '
const fs = require("fs");
const file = "tsconfig.base.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
const paths = config.compilerOptions?.paths ?? {};
for (const [alias, [first]] of Object.entries(paths)) if (!fs.existsSync(first)) delete paths[alias];
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
'

yarn install

# Must run after yarn install: it overwrites the published package so the shipped skills match the SDK checkout.
rm -rf node_modules/@ethlete/agent-rules
cp -a "$sdk/dist/libs/agent-rules" node_modules/@ethlete/agent-rules

git init -q -b main
node node_modules/@ethlete/agent-rules/src/index.js sync

node -e '
const fs = require("fs");
const file = ".claude/settings.json";
const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
const deny = ["WebFetch", "WebSearch", "Bash(curl:*)", "Bash(wget:*)", "Bash(gh:*)",
  "Bash(git clone:*)", "Bash(git fetch:*)", "Bash(git pull:*)", "Bash(git ls-remote:*)", "Bash(git remote add:*)"];
settings.permissions = { ...settings.permissions, deny: [...new Set([...(settings.permissions?.deny ?? []), ...deny])] };
fs.mkdirSync(".claude", { recursive: true });
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
'

git add -A
git -c user.name=designer -c user.email=designer@example.invalid commit -q -m "chore: initial import"
yarn husky
echo "make-copy: $(git rev-list --count HEAD) commit, $(git ls-files | wc -l) files in $target"
