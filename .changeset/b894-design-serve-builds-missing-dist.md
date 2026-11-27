---
'@ethlete/cli': patch
---

The design server builds the checkout lib build folders its drawings need when they do not exist yet (for example `dist/libs/components` in a fresh checkout), instead of answering every system read with 503.
