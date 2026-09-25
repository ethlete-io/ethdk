---
'@ethlete/query': minor
---

`dateQueryField({ as: 'string' })` types the field `string | null`, so `[formField]` binds it to `<et-date-input>`, `<et-date-time-input>` and `<et-time-input>` under `strictTemplates`; the URL carries the control's `valueFormat` string verbatim. `dateQueryField()` without the option still holds a `Date`.
