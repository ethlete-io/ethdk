---
'@ethlete/cli': patch
---

GitLab token checks refuse redirects, `auth.json` is narrowed before the token is written, `release` matches its flags exactly, and `doctor` reports a broken legacy config file.
