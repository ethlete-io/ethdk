---
'@ethlete/cdk': patch
'@ethlete/components': patch
---

Closing a query-param overlay no longer cancels a pending navigation that already drops its query param, such as a `routerLink` inside the overlay.
