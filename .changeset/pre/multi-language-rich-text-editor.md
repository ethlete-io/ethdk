---
'@ethlete/components': minor
---

Rich text editor: new `et-multi-language-rich-text-editor` - authors the same content in several consumer-defined `languages`, switching between them from a toolbar dropdown that flags which languages are still empty. Its value is a `Record<languageCode, markdown>`, so every translation persists in one form field; bind it with `[formField]` and use the exported `requiredLanguages` validator to require specific translations.
