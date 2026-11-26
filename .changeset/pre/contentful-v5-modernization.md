---
'@ethlete/contentful': major
---

Contentful v5: the package peers on `@ethlete/components` instead of `@ethlete/cdk` (and drops
`@angular/cdk` and `rxjs`). `et-contentful-image` renames `hasPriority` to `priority` and loses its
`*Class` inputs - style the static `et-picture-*` classes instead. The rich text renderer now diffs
keyed, so element DOM and embedded component instances survive updates and reorders; the
`useTailwindClasses` option is gone. Run `nx g @ethlete/contentful:migrate-to-contentful-v5`.
