---
'@ethlete/components': minor
'@ethlete/core': minor
'@ethlete/query-devtools': minor
'@ethlete/contentful': minor
'@ethlete/cli': patch
---

SDK component styles now sit in `@layer components.sdk`, nested in `components`, so an app rule in `@layer components` overrides every SDK component style, internal parts included.
