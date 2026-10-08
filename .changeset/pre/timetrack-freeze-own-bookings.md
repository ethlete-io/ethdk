---
'@ethlete/timetrack': minor
'timetrack-app': patch
---

A finished day freezes its rows only once this app booked it; a day only another machine booked keeps being re-cut. `withFrozenRows` takes the day's `ledger` instead of `held`.
