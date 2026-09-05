---
'@ethlete/query': patch
---

Query forms: a field with `appendToUrl: false` now picks up a foreign write that lands in the form's own navigation, instead of leaving the form value and the URL out of step.
