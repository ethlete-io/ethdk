---
'@ethlete/components': patch
---

On touch, the compact pager and `size="sm"` pagination items take a 44px hit area through an invisible pseudo-element. Their visible size and spacing stay unchanged, and a tap on an item never reaches its neighbour.
