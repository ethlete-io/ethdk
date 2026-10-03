---
'@ethlete/components': patch
---

`et-rich-text-editor` and `et-multi-language-rich-text-editor` no longer throw when their bound value is `null` (e.g. an empty field from API data); both render it as an empty document.
