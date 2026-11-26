# Check the app CSS that overrides SDK component styles

SDK component styles from `@ethlete/components`, `@ethlete/core`, `@ethlete/query-devtools` and
`@ethlete/contentful` moved from `@layer components` into `@layer components.sdk`, a layer nested
in `components`. An app rule in `@layer components` now beats every SDK component style, whatever
its specificity. Before, it tied with the SDK on layer, and the SDK usually won on specificity or
source order, because its styles are injected after the app's stylesheet.

This only changes anything with Tailwind 4. With Tailwind 3, `@layer` is a Tailwind directive that
emits unlayered CSS, which already beat the SDK: report that and delete this task.

## Before you start

If the repo's own styling rules (a styleguide, `CONTRIBUTING.md`, the parts of `AGENTS.md` outside
the generated block) forbid a change below, follow them and report the conflict.

## What to change

1. Find the app CSS in `@layer components`, global stylesheets and inline `styles:` included:

   ```bash
   grep -rlE '@layer components' apps libs --include='*.css' --include='*.scss' --include='*.sass' --include='*.less' --include='*.ts'
   ```

2. In each, find the rules that select an SDK element: an `.et-` class, an `et-` element, or an
   app class the template puts on an SDK component. Those rules used to lose to the SDK where both
   set the same property, and now win. Check the views that use them. Where a view now looks wrong
   because the rule was never meant to apply, delete the rule or the property.
3. Find the overrides that only existed to beat SDK styles:

   ```bash
   grep -rlE '\bet-' apps libs --include='*.css' --include='*.scss' --include='*.sass' --include='*.less' | xargs grep -nE '!important|(body|html|:is\(|:where\().*\.et-|(\.et-[a-z0-9-]+)\1'
   ```

   Check each `!important` hit against the selector it belongs to: only the ones on an SDK element
   count.

   A rule in `@layer components`, `@layer utilities` or unlayered no longer needs `!important`, a
   doubled class or a `body` prefix to beat the SDK. Remove them where the rule still wins after
   the change in the browser. Keep them where they beat another app rule.

## Leave these alone

- A library that ships its own CSS to other repos, unless it wraps that CSS in a layer of its own.
- Generated theme files, such as the surface and colour themes `@ethlete/core` writes.
- Utilities in templates. A utility still beats both the SDK and app rules in `@layer components`.

## Done when

- Every app rule from step 2 is checked in the browser, kept or deleted.
- The type check, lint and build pass for every project you changed.
- A view you cannot open (the login fails, no API) is listed as unchecked in your final message;
  that does not block the task.

Then delete this task file.
