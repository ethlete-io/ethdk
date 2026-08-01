---
'@ethlete/components': minor
---

Breadcrumb: add `etBreadcrumbSeo` (`BREADCRUMB_SEO_IMPORTS`) - opt-in `schema.org` **BreadcrumbList**
JSON-LD for the trail, which is what earns a site the breadcrumb line in a search result. Crumbs state
their own `name` and `url` (new inputs on `etBreadcrumbItemTemplate`) rather than having them scraped
from the DOM: a crumb's content is a template with no single text form, and a `routerLink` is a path
where schema.org wants an absolute URL. Loading and unnamed crumbs are skipped, the last crumb needs
no `url`, and collapsing the trail doesn't change the markup.
