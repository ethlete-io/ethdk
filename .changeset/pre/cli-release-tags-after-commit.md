---
'@ethlete/cli': major
---

Breaking: `release()` takes `{ args, root?, invocation? }` and resolves to an exit code instead of exiting. `et release` tags after the release commit and takes `--message` and `--help`; `et update` names the `.npmrc` whose token was refused.
