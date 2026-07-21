---
'@ethlete/components': patch
---

Form field: text-field controls (`et-input`, `et-number-input`,
`et-password-input`, `et-textarea`) no longer render an empty `autocomplete=""`
attribute when no autocomplete is set — the attribute is now omitted, clearing
Chrome's "Incorrect use of autocomplete attribute" warning.
