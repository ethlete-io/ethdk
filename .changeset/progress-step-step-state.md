---
'@ethlete/components': minor
---

Rename the `et-progress-step` input `state` to `stepState`. `RouterLink` also has a `state` input, so `<a [routerLink] et-progress-step [state]="...">` bound the value to both, failed the strict template type check and handed a string to the router as navigation state.

```html
<!-- before -->
<a [routerLink]="['/checkout/account']" et-progress-step state="complete">Account</a>

<!-- after -->
<a [routerLink]="['/checkout/account']" et-progress-step stepState="complete">Account</a>
```
