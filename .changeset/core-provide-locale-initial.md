---
'@ethlete/core': minor
---

`provideLocale(locale?)` now accepts the initial locale: `provideLocale('de')` starts `injectLocale().currentLocale` at `'de'`. Without an argument it still starts at `'en'`.
