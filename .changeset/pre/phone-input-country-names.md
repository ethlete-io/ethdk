---
'@ethlete/components': patch
---

Phone input: the country list builds one `Intl.DisplayNames` and one `Intl.Collator` per locale instead of one per country and comparison.
