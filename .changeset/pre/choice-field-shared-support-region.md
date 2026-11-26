---
'@ethlete/components': patch
---

`et-choice-field` now renders the shared `et-form-support` region instead of its own copy; at-rest rendering is unchanged, and the error/warning/hint swap animates like every other control (no direction-specific leave). Every shared support region also gets `unicode-bidi: isolate` back.
