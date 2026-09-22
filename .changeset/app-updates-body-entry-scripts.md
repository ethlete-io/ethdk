---
'@ethlete/core': patch
---

`provideAppUpdates` detects a new deploy again when the entry scripts sit at the end of `<body>`, as the Angular CLI emits them, and ignores scripts the app appended itself.
