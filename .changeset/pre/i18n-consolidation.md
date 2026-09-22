---
'@ethlete/components': major
'@ethlete/core': minor
---

Localization: one mechanism for every string the library renders. `createLabels` (core) backs a
`provide<Domain>Labels` / `inject<Domain>Labels` pair per domain - 22 of them, all locale-reactive and
signal-shaped. See the [localization guide](https://ethlete-sdk-docs-next.web.app/components/localization).

- New tokens make the rich text editor, stream, grid, loader, chip, calendar, time picker, dropzone,
  select, cascader, phone input, slider, date/time and notification strings overridable.
- **Breaking:** `inject*Labels()` now returns a signal; the string fields left `StreamConsentConfig`,
  `StreamPlayerErrorConfig`, `PipSlotPlaceholderConfig`, `GridConfig` and `NotificationManagerConfig`
  (with their `transformer` hooks); per-instance label inputs default to `null` instead of English.
- Fixes the PiP close/back buttons, which set an attribute literally named `attr.aria-label`.
