---
'@ethlete/query': minor
---

`defineQueryForm().observe()` takes `navigationExtras` (`scroll`, `state`) for each navigation that writes the form's params. With `scroll: 'manual'`, a debounced search no longer scrolls the page to the top under `withInMemoryScrolling`.
