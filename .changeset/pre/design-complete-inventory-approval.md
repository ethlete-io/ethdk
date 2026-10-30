---
'@ethlete/cli': minor
---

`design complete` fails a page as `INVENTORY-UNAPPROVED` until its control inventory is approved; the design server answers `/__design/inventory` and `/__design/inventory-approve`, which writes `inventory.json` and refuses pages with undeclared or unclassified controls.
