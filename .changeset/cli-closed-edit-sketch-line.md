---
'@ethlete/cli': patch
---

`design check` no longer reports an edit sketch as `OPENED` when the same run discards it because every state draws as before; it prints `CLOSED <product> <part>@edit: draws as before` instead.
