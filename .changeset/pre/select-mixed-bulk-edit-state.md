---
'@ethlete/components': minor
---

Add a two-way `mixed` bulk-edit state (plus `mixedLabel` where the control has a text display slot) across the form controls: select (single, multi, searchable, headless, virtualized), cascader, input, number-input, password-input, textarea, color-input, date-input, time-input, date-time-input, date-range-input, duration-input, tag-input, phone-input, slider, range-slider, rating, and the selection-list groups (radio, checkbox-group, segmented). While `mixed` is set the raw form value stays untouched and masked; the first user commit replaces it and resolves the state. All implementations follow one executable contract (shared conformance suite); checkbox keeps expressing the concept via its platform-named `indeterminate`, and switch deliberately stays two-state (ARIA forbids a mixed switch).
