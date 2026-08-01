---
'@ethlete/contentful': major
---

Contentful v5: the package now peers on `@ethlete/components` instead of `@ethlete/cdk` (and drops `@angular/cdk` and `rxjs`). `et-contentful-image` renames `hasPriority` to `priority` and loses its `imgClass`/`pictureClass`/`figureClass`/`figcaptionClass` inputs — style the static `et-picture-*` classes instead. The rich text renderer now updates every preserved embedded component's inputs on content changes (previously the first one stayed stale), reorders mixed-type embeds, and no longer exports its render-command internals. Run `nx g @ethlete/contentful:migrate-to-contentful-v5` to migrate.
