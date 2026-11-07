---
'@ethlete/cli': patch
'@ethlete/components': minor
'ethlete-studio': patch
---

The focus ring takes the public `--et-focus-ring-offset`, `--et-focus-ring-width` and `--et-focus-ring-color` tokens;
they do not inherit. `design check` no longer reports SDK-PRIVATE-VAR on parts a product takes from its base, and
no longer reports the clipping inside `et-spinner` as CLIPPED. Studio hides the restart hint while a restart runs or
after it failed.
