---
'@ethlete/components': patch
---

Stop `selectOptionsFromQuery` from passing a failed search to Angular's `ErrorHandler`, since the select already shows it in its error row.
