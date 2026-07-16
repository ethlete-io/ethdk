---
'@ethlete/components': minor
---

Forms: new `et-date-range-input` control (import `DATE_RANGE_INPUT_IMPORTS`) — one form control with two text fields sharing a single range-mode `et-calendar` picker. Value shape `{ start: string | null; end: string | null }` in `valueFormat`; each side parses strictly against `displayFormat` with its own parse-error signal. The picker trigger/surface directives now work with either date control host.
