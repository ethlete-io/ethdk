#!/usr/bin/env bash
# Replaces libs/types/src/lib/api with the folder of a generator commit, then normalizes it.
# The commit is read as data only: nothing from it is executed. Every imported path must pass the
# allowlist, because a config file anywhere in the workspace (project.json, eslint.config.mjs, ...)
# is executed by nx or eslint.
# Usage: tools/api-models/import.sh <commit>
set -euo pipefail

commit=${1:?usage: import.sh <commit>}
folder=libs/types/src/lib/api

git fetch --no-tags --depth=1 origin "$commit"

allowed='^libs/types/src/lib/api/([A-Za-z0-9_-]+/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.ts$'
rejected='(\.(config|spec|test)\.[cm]?ts|\.d\.ts)$'
bad=$(git ls-tree -r --full-tree "$commit" -- "$folder" | while IFS=$'\t' read -r meta path; do
  read -r mode type _ <<<"$meta"
  if [ "$mode" != 100644 ] || [ "$type" != blob ] || ! [[ $path =~ $allowed ]] || [[ $path =~ $rejected ]]; then
    printf '%s %s\n' "$mode" "$path"
  fi
done)
if [ -n "$bad" ]; then
  echo "The generator commit contains paths that are not plain model files:" >&2
  echo "$bad" >&2
  exit 1
fi
if [ -z "$(git ls-tree -r --name-only "$commit" -- "$folder/index.ts")" ]; then
  echo "The generator commit has no $folder/index.ts" >&2
  exit 1
fi

git rm -rq --ignore-unmatch -- "$folder"
rm -rf -- "$folder"
git checkout "$commit" -- "$folder"
node tools/api-models/normalize.mjs "$folder"
git add -- "$folder"
