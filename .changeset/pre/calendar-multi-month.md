---
'@ethlete/components': minor
---

Calendar: `monthsShown` renders several months side by side - the classic two-month range picker,
where a range spanning the turn of a month is one gesture. The span shares one keyboard scope, one
selection and a band that runs through the seam, and stepping moves by a single month. Headless:
`monthPages()`. The date inputs deliberately don't forward it.
