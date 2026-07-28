---
'@ethlete/components': minor
---

Add the breadcrumb: `<et-breadcrumb>` with template-authored crumbs
(`etBreadcrumbItemTemplate`, `loading` placeholders, `etBreadcrumbSeparator`), measured overflow that
moves the middle crumbs into a toggletip, and the `etBreadcrumbTemplate` /
`<et-breadcrumb-outlet>` pair (plus `provideBreadcrumbManager`) for rendering a routed page's trail in
the app shell. Labels are localizable via `provideBreadcrumbLabels`.
