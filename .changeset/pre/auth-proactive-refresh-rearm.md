---
'@ethlete/query': patch
---

Fix the proactive token refresh never firing, and re-arm a scheduled refresh that came
due while it could not run.
