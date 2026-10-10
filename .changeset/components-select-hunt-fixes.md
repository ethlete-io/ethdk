---
'@ethlete/components': minor
---

Add `displayWith` to `et-select`: it labels a value no loaded option carries, as the trigger text in single mode and the chip label in multi mode.

Fix select, cascader and tag input bugs:

- A select separator, paste or close commit now commits the value of a visible option whose label matches the text, instead of storing the label as a custom string.
- A select paste keeps the pieces it refused (a duplicate, one past `maxSelection`, one `normalizeValue` rejects) in the search field.
- Windowed data-driven select rows now attach and measure their element when `valueKey` is set.
- Closed-trigger typeahead no longer emits `pickOption` in `pickOnly` mode, and no longer re-emits it for the value already selected.
- A cascader search result under a disabled branch is disabled and can no longer be committed.
- `et-tag-input` no longer throws when its value is `null`.
