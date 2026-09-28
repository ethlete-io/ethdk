# timetrack rows + review scan - open findings

Scan of `libs/timetrack/src/lib/rows` and `libs/timetrack/src/lib/review` from 2026-09-28. 0 High, 0 Medium, 1 Low, 0 Spec (verified 2026-09-28: 8 confirmed, 2 re-rated, 0 refuted, 0 unverified). Skipped (not read): `review/statements.ts`, `lane-issues.ts`, `call-pieces.ts`, `model.ts` (partly read); all specs. 20 Low and 1 Spec fixed 2026-09-28.

## rows/build-rows, snap, round

- Low: every grid function floors or rounds the UTC epoch (`rows/snap.ts:10-11`, `rows/cut.ts:67,139`, `review/statements.ts:24-28`). An increment of 30 or 60 minutes puts rows off the local quarter in zones with a :30 or :45 offset (India, Nepal). Round on local time, or document the 15-minute limit. M
