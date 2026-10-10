---
'@ethlete/components': patch
---

Fix the dropzone's too-large and too-small messages omitting the limit when it comes from the `maxFileSize` or `minFileSize` input instead of the `dropzoneFiles()` rule.
