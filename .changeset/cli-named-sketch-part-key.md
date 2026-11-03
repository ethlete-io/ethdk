---
'@ethlete/cli': patch
---

A named sketch (`sketch new --name`) is now checked against its own part: the metadata check of sketch check and ready,
and the variant diff, compare the part key instead of the sketch id.
