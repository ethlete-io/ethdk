# Work through the cdk migration tasks

`nx g @ethlete/cdk:migrate-from-cdk` rewrites every import whose successor in `@ethlete/components` or
`@ethlete/core` has the same contract. What it cannot rewrite, it writes into
`migrate-from-cdk-tasks.md` at the repository root. That file is the input for this task.

If `migrate-from-cdk-tasks.md` is not there, the generator found nothing that needs a decision, and
there is nothing to do here.

## How to work the file

Take one section at a time. Every entry names a `file:line`, so read the call site before you change
it. Each section states what the successor API expects.

- **`<et-picture>` without `alt`.** `alt` is required on the components picture. `alt=""` is allowed and
  states that the image is decorative. Which one a site needs is a product decision: read the
  surrounding markup, and use `alt=""` only where the image carries no information. Where a real
  description is needed and nothing in the code holds one, leave the site in the report and say so.
- **Picture class inputs.** `imgClass`, `pictureClass`, `figureClass` and `figcaptionClass` are gone.
  The report groups each site by what its classes express: a definite box in both axes takes `fit` on
  the host, a single constrained axis takes a style on `.et-picture-img`. Follow the group, not a
  uniform rewrite - `fit` on an image that sizes its own box collapses the layout.
- **Themed spinners.** The cdk spinner defaulted to a themed blue; the components spinner defaults to
  `currentColor`. A spinner inside a button or a link should inherit. A standalone one that carried the
  brand colour needs `color="brand"`, using the theme name that app registers.
- **Spinner `[mode]` bindings.** `mode` split into the `determinate` boolean. Rewrite the expression by
  what it meant, for example `[mode]="isKnown ? 'determinate' : 'indeterminate'"` becomes
  `[determinate]="isKnown"`.
- **Symbols whose contract changed.** These imports still point at `@ethlete/cdk` on purpose. Move one
  only when its call site matches the successor API. The entry names the successor and links its guide.
- **Successors that need a newer package.** Do not touch these. Update `@ethlete/components` or
  `@ethlete/core` first, then run `nx g @ethlete/cdk:migrate-from-cdk` again.

## When you are done

1. Run the type check and the lint task of every project you changed.
2. Run the tests that cover the components you touched.
3. Delete the entries you finished from `migrate-from-cdk-tasks.md`, and delete the file once it is
   empty. Leave any entry you could not decide, with a line saying what is missing.

The cdk migration guide is at <https://ethlete-sdk-docs.web.app/cdk/migration>.
