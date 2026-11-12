---
'@ethlete/components': minor
'@ethlete/core': minor
'@ethlete/query-devtools': minor
'@ethlete/contentful': minor
'@ethlete/cli': patch
---

SDK component styles now sit in `@layer components.sdk`, so an app rule in `@layer components` overrides them; `et update` leaves a task to check those rules.
