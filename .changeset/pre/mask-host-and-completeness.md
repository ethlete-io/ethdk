---
'@ethlete/components': minor
---

Masked input: the mask now attaches through a public `INPUT_MASK_HOST` contract (provided by `et-input` out of the box), so custom field directives can host `[etInputMask]` too. Pattern masks additionally expose `complete()` on the directive (`0`/`a`/`*` slots required, `9` optional; `null` for masks without completeness) via a new optional `MaskSpec.isComplete`.
