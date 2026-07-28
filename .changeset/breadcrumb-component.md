---
'@ethlete/components': minor
---

Add the breadcrumb: `<et-breadcrumb>` with template-authored crumbs
(`etBreadcrumbItemTemplate`, `loading` placeholders, `etBreadcrumbSeparator`) and measured overflow that
moves the middle crumbs into a toggletip. In a routed app each view contributes only the crumbs it owns
via `<ng-template etBreadcrumbSegment>`, and the single `<et-breadcrumb-outlet>` in the shell renders
every registered segment as one trail — no view restates the path above it. Labels are localizable via
`provideBreadcrumbLabels`.
