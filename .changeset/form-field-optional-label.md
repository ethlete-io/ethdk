---
'@ethlete/components': minor
---

Form field: the label is now truly optional - the label-mode layouts (`static`,
`floating-outside`) no longer reserve the label band when no `<et-label>` is
projected.

- Text-field controls (`et-input`, `et-number-input`, `et-password-input`,
  `et-color-input`, `et-textarea`) now accept `aria-label` / `aria-labelledby`,
  forwarded onto the native control; a consumer `aria-labelledby` overrides the
  projected `<et-label>`.
- In dev mode a form field whose control has no accessible name - no `<et-label>`
  and no `aria-label`/`aria-labelledby` - now throws (`ET2201`). A placeholder is
  not an accessible name.
