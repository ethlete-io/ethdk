---
'@ethlete/components': minor
---

Breadcrumb: add `etBreadcrumbSeo` (`BREADCRUMB_SEO_IMPORTS`) - opt-in `schema.org` **BreadcrumbList**
JSON-LD, which is what earns a site the breadcrumb line in a search result. Crumbs state their own
`name` and `url` through new inputs on `etBreadcrumbItemTemplate`; loading and unnamed crumbs are
skipped, and the last crumb needs no `url`.
