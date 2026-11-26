---
'@ethlete/components': patch
---

Fix `et-phone-input` corrupting an international number typed one character at a
time. The field no longer rewrites itself mid-entry, so each keystroke reads the
text the user actually typed.
