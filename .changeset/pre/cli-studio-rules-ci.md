---
'@ethlete/cli': none
---

The Studio gates leave the pre-push hook for CI: the pull request runs `design check --product studio` and `--slow`, and the old `prepush-*` gate code is gone.
