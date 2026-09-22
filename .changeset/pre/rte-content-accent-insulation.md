---
'@ethlete/components': patch
---

Rich text editor content no longer retints when the editor gains focus. The field frame is an `et-color-interactive--has-focus` ancestor that re-resolves the accent tokens on focus, and rendered content reading the accent - token chips (their outline and fill), links and the caret - inherited that shift. The content root now re-anchors the accent tokens to their resting value, insulating it from the field's interaction state (the same immunity the interactive toolbar buttons already have from carrying `et-color-interactive`).
