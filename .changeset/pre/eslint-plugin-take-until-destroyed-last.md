---
'@ethlete/eslint-plugin': minor
---

Add `take-until-destroyed-last` to the recommended config: `takeUntilDestroyed()` must be the last operator in a `.pipe()`, since an operator after it can keep the subscription alive.
