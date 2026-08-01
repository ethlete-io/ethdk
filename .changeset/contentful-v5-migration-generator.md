---
'@ethlete/contentful': minor
---

Add the `migrate-to-contentful-v5` generator. It renames the `et-contentful-image` `hasPriority` input to `priority` in HTML and inline templates, declares `@ethlete/components` where `@ethlete/contentful` is a dependency, and writes `contentful-v5-migration-tasks.md` for the removed picture class inputs, the removed renderer internals, and a leftover `@ethlete/cdk` dependency.
