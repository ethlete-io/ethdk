---
'@ethlete/contentful': major
---

Contentful v5: the package now peers on `@ethlete/components` instead of `@ethlete/cdk` (and drops `@angular/cdk` and `rxjs`). `et-contentful-image` renames `hasPriority` to `priority` and loses its `imgClass`/`pictureClass`/`figureClass`/`figcaptionClass` inputs — style the static `et-picture-*` classes instead. The rich text renderer now diffs keyed: unchanged elements and text keep their DOM, embedded components are keyed by entry/asset id (instances survive reorders and move with their entry; previously the first preserved one never got input updates), and the render-command internals plus the unused `useTailwindClasses` config option are gone. Run `nx g @ethlete/contentful:migrate-to-contentful-v5` to migrate.
