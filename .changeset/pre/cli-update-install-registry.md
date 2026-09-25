---
'@ethlete/cli': patch
---

`yarn et update` on yarn 1 installs from the registry the repo's `.npmrc` or `.yarnrc` names, not the default registry yarn exports to scripts.
