---
'@ethlete/cdk': minor
---

Add an `et-legacy` marker class to every cdk component host. Because cdk and
`@ethlete/components` reuse many of the same global class names (`et-overlay`,
`et-menu`, `et-radio`, `et-select`, `et-checkbox`, `et-tooltip`, …), apps that
consume both libraries at once can no longer target one without hitting the
other. Every cdk element now carries `et-legacy` alongside its usual classes, so
consumer overrides can be scoped to the cdk implementation only - e.g. rewrite
`.et-overlay { … }` as `.et-overlay.et-legacy { … }`. The marker is inert (no cdk
CSS references it), so cdk rendering is unchanged.
