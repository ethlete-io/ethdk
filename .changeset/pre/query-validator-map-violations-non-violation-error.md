---
'@ethlete/query': patch
---

`validateWithQuery` / `validateWithV2Query`: a network or other non-violation error keeps its form-level error when a custom `mapViolations` is set, instead of validating the field as clean.
