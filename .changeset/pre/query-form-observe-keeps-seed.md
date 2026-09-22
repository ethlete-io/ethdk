---
'@ethlete/query': patch
---

`defineQueryForm().observe()` now merges the URL onto the form's live model, so a value written
before `observe()` survives and only the fields the URL names are overwritten.
