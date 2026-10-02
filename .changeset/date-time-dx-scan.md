---
'@ethlete/components': major
---

Time picker and time inputs: remove the no-op `secondStep` input. Delete any `secondStep` binding; nothing else changes.

Date and time controls warn in dev mode about a value that does not match `valueFormat`. They gain `firstDayOfWeek`, accept `null` for `displayFormat` and `valueFormat`, and the date validators take a `timeZone` option.
