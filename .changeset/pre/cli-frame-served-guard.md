---
'@ethlete/cli': patch
---

Opening a design frame now fails with the URL and HTTP status when the design server answered 400 or above (such as Vite's 403 for a file outside `server.fs.allow`), instead of measuring the error page.
