---
'@ethlete/components': minor
---

Calendar and date inputs: `precision` (`'day' | 'month' | 'year'`) makes them month or year pickers -
picking in that grid writes the value (the start of the unit) instead of drilling further, and ranges
compare, band and complete at the same unit. On `et-date-input` / `et-date-range-input` it also
derives the text format, so `displayFormat` now defaults to `null`.
