---
'@ethlete/components': major
---

Breaking: stop exporting the duration input format helpers `UNIT_MS`, `deriveDurationFormatSpec`, `formatDuration` and `parseDuration`. The `DurationFormatSpec`, `DurationSegment` and `DurationUnit` types stay public. `et update` runs a migration that marks the uses.
