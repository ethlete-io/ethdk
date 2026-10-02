---
'@ethlete/core': patch
---

An overlay opened from inside another overlay that closes first (a dialog opened from a menu item) now returns focus to that overlay's own restore target instead of `<body>`.
