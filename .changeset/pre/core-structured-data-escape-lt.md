---
'@ethlete/core': patch
---

`applyStructuredDataBinding` escapes `<` in its JSON-LD, so a value holding `</script>` or `<!--` no longer corrupts or breaks the script in SSR output.
