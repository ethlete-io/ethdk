---
'@ethlete/components': patch
---

An app's `--et-button-padding`, `--et-button-border-radius` and `--et-icon-button-*` size tokens on `.et-button` / `.et-icon-button` no longer change the buttons SDK components render themselves (pagination, table header triggers, breadcrumb overflow, scheduler, date range presets, rich text toolbar), even from an unlayered rule
