---
'@ethlete/contentful': patch
---

The rich-text renderer skips an embedded entry or asset missing from `includes`, or an entry without a custom component, with a dev-mode warning instead of throwing ET004-ET006 and rendering nothing.
