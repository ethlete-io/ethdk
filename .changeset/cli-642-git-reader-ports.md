---
'@ethlete/cli': patch
---

Every git call of the design cli now goes through its git reader; `design edit` reads the old design and the baseline history reads its versions in one `git cat-file --batch`.
