#!/usr/bin/env bash
# Usage: tools/api-models/write-changeset.sh <api-commit>
set -euo pipefail

sha=${1:?usage: write-changeset.sh <api-commit>}
[[ $sha =~ ^[0-9a-f]+$ ]] || { echo "Not a commit sha: $sha" >&2; exit 1; }

file=.changeset/api-models-master-$sha.md
cat > "$file" <<CHANGESET
---
'@ethlete/types': patch
---

Update the API models from API master ($sha).
CHANGESET
git add -- "$file"
