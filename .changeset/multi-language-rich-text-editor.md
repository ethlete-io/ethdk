---
'@ethlete/components': minor
---

Add `et-multi-language-rich-text-editor`: a rich text editor that authors the same content in
several consumer-defined languages, switching between them from a dropdown in the toolbar. Its value
is a `Record<languageCode, markdown>`, so every translation persists in one form field, and the
switcher flags which languages are still missing content. Bind it with `[formField]` and pass the
required `languages`; use the exported `requiredLanguages` validator to require specific translations.
