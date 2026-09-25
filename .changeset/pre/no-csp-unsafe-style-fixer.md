---
'@ethlete/eslint-plugin': patch
---

`ethlete/no-csp-unsafe` fixes a static template `style="…"` attribute. It rewrites `style="width: 40%; margin-top: 4px"` to `[style]="{ width: '40%', 'margin-top': '4px' }"`, which a strict CSP allows. A value with a quote, `url(`, `!important` or a comment stays a manual fix.
