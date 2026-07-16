---
'@ethlete/components': minor
---

Forms: new `et-tag-input` control (`TAG_INPUT_IMPORTS`) — free-text tags as removable chips with an inline field inside the `et-form-field` shell. Commits on configurable `separators` (Enter/comma by default) and blur, `normalizeTag`/`allowDuplicates`/`maxTags`, Backspace removes the last tag, and pastes split on separators and newlines. For tags with suggestions, compose the select (`multiple` + search + `allowCustomValues`) instead.
