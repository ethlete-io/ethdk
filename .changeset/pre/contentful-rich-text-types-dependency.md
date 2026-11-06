---
'@ethlete/contentful': patch
---

Ship `@contentful/rich-text-types` as a dependency instead of a required peer dependency, since its node type constants are used at runtime.
