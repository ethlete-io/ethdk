#!/bin/bash
set -euo pipefail
cd /home/tom/dev/ethlete-sdk
DIR=libs/query/generators/migrate-from-ngrx-toolkit
OLD_TIP=$(git rev-parse refs/heads/next)
FINAL=$(git rev-parse "$OLD_TIP:$DIR")
BASE=$(git rev-parse 3a350896f^)
export GIT_INDEX_FILE=/tmp/rw-idx
rm -f "$GIT_INDEX_FILE" /tmp/next-rewrite-map.txt
declare -A MAP
MAP[$BASE]=$BASE
for c in $(git rev-list --reverse --topo-order "$BASE..$OLD_TIP"); do
  git read-tree "$c^{tree}"
  if git cat-file -e "$c:$DIR" 2>/dev/null; then
    git ls-files -z -- "$DIR" | xargs -0 -r git update-index --force-remove --
    git read-tree --prefix="$DIR/" "$FINAL"
  fi
  TREE=$(git write-tree)
  PARENTS=""
  for p in $(git rev-list --parents -n1 "$c" | cut -d' ' -f2-); do PARENTS="$PARENTS -p ${MAP[$p]:-$p}"; done
  NEW=$(GIT_AUTHOR_NAME="$(git log -1 --format=%an $c)" GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae $c)" GIT_AUTHOR_DATE="$(git log -1 --format=%aD $c)" \
        GIT_COMMITTER_NAME="$(git log -1 --format=%cn $c)" GIT_COMMITTER_EMAIL="$(git log -1 --format=%ce $c)" GIT_COMMITTER_DATE="$(git log -1 --format=%cD $c)" \
        git commit-tree "$TREE" $PARENTS -F <(git log -1 --format=%B "$c"))
  MAP[$c]=$NEW
  echo "$(git rev-parse --short=9 $c) $(git rev-parse --short=9 $NEW)" >> /tmp/next-rewrite-map.txt
done
NEW_TIP=${MAP[$OLD_TIP]}
unset GIT_INDEX_FILE
[ -z "$(git diff "$OLD_TIP" "$NEW_TIP")" ] || { echo "TREE DIFF - abort"; exit 1; }
if [ "${1:-}" = "--apply" ]; then
  git update-ref -m "rewrite: generic toolkit fixtures" refs/heads/next "$NEW_TIP" "$OLD_TIP"
  echo "applied $OLD_TIP -> $NEW_TIP"
else
  echo "dry $OLD_TIP -> $NEW_TIP"
fi
echo "old tip: $OLD_TIP" > /tmp/next-rewrite-oldtip.txt
