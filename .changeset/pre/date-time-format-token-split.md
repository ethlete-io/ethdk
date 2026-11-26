---
'@ethlete/components': major
---

- **Breaking:** date-only controls and their validators now default to `yyyy-MM-dd`; the date-time controls read the new `DATE_TIME_FORMAT` token (`provideDateTimeFormat()`) instead of `DATE_FORMAT`.
- Add `dateTimeRangeOrder` for `et-date-time-range-input`; `dateRangeOrder` now reads `DATE_FORMAT` and takes no `timeZone`.
