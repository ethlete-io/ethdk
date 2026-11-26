---
'@ethlete/cli': patch
---

`release --force` stages only the files `changeset version` changed instead of running `git add .`, so unrelated uncommitted changes stay out of the "Release versions" commit.
