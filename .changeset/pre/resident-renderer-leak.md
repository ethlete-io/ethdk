---
'@ethlete/cli': patch
---

The resident design process reuses its idle draw pages across draws and runs instead of opening a new browser context for each draw and keeping it open, which left hundreds of Chromium renderers running during a full product check.
