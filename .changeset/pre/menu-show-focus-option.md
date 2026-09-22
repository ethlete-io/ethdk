---
'@ethlete/components': patch
---

Menu: a programmatically opened menu now honours `autoFocus` instead of opening with no keyboard entry point, and `show()` / `toggle()` / `openAt()` take `{ source, focus }` to override it per call.
