---
'@ethlete/components': patch
---

Rich text editor: the alignment tool now applies to the whole table column (GFM alignment is per column, so a single aligned cell would not survive serialization) and disables itself inside lists, where alignment has no serialized form. Lists swept up by a cross-block selection are skipped instead of receiving a lost `text-align`.
