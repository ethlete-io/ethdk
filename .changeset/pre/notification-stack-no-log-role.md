---
'@ethlete/components': patch
---

Drop `role="log"`, `aria-live` and `aria-relevant` from `et-notification-stack`. Each notification already is its own `status` or `alert` live region, so screen readers no longer announce it twice.
