---
'@ethlete/components': minor
---

A readonly `et-dropzone` stops looking like a drop target: no action buttons, a solid border, and
an empty one reads "No files" instead of the drop prompt. The prompt now comes from the
`DROPZONE_LABELS` set, which it never read before.
