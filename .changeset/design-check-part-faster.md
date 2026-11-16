---
'@ethlete/cli': patch
---

`design check --part` runs about 1.5 s faster: the class rules read only that part's files, the Tailwind class facts and the typecheck run side by side, and the done-part count is skipped.
