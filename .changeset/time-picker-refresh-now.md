---
'@ethlete/components': patch
---

Time picker: "now" is re-read when focus enters the picker, so one that stays mounted past midnight anchors and filters against the current day.
