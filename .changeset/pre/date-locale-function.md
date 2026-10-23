---
'@ethlete/components': minor
---

`provideDateLocale` also accepts a function `(locale) => dateFnsLocale`, which follows `injectLocale().currentLocale` so date controls, calendars, pickers and range validators reformat on a live language switch. `injectDateLocaleSignal()` exposes the resolved locale as a signal; a control's `locale` input still wins.
