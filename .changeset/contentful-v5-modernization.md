---
'@ethlete/contentful': major
---

Contentful v5: the package now peers on `@ethlete/components` instead of `@ethlete/cdk` (and drops `@angular/cdk` and `rxjs`). `et-contentful-image` renames `hasPriority` to `priority` and loses its `imgClass`/`pictureClass`/`figureClass`/`figcaptionClass` inputs — style the static `et-picture-*` classes instead. The rich text renderer now diffs keyed: unchanged elements and text keep their DOM, every preserved embedded component gets fresh inputs (previously the first one stayed stale), nested components are reattached instead of lost when their parent is rebuilt, and the render-command internals are no longer exported. Run `nx g @ethlete/contentful:migrate-to-contentful-v5` to migrate.
