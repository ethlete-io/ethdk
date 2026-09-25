# Style app components with Tailwind utilities

The earlier guidance left app styling open, so app components were often styled with a BEM class
system or a `.css` file per component. The `app-styling` rule now says: every app component is laid
out and styled with Tailwind utility classes in its template, and CSS is written only for what a
utility cannot express.

## Before you start

`et update` regenerates the agent rules when it moves `@ethlete/agent-rules`. If this repo has no
`app-styling` rule yet (in `AGENTS.md`, or under `.claude/rules/ethlete/`), run
`npx ethlete-agents sync` first, then read the rule.

## Find the call sites

```bash
git ls-files 'apps/**/*.css' 'apps/**/*.scss' 'libs/**/*.css' 'libs/**/*.scss'
grep -rnE 'styleUrls?:' apps libs --include='*.component.ts'
grep -rnE 'class="[a-z0-9-]+__[a-z0-9-]+' apps libs --include='*.html' --include='*.ts'
grep -rnE '@layer components' apps libs --include='*.css' --include='*.scss'
```

## What to change

1. Replace each class that sets layout, spacing, sizing or typography with the utilities in the
   template, and delete the rule from the stylesheet.
2. Replace a hardcoded colour with a theme utility (`bg-et-surface-bg`, `border-et-surface-border`,
   `text-et-<theme>`) or a `var(--et-…)` token.
3. Keep what utilities cannot express (a keyframe, a complex selector) as CSS, unlayered or in
   `@layer utilities`. Move any app rule out of `@layer components`: SDK styles land in that layer
   after yours, so the app rule loses.
4. To restyle an SDK component, set its `--et-*` tokens first, then a utility on the element.
5. Delete a stylesheet that ends up empty, and its `styleUrl`.

## Leave these alone

- A library that ships its own CSS to other repos, and component source in an SDK-style library
  built with `ViewEncapsulation.None`. The rule is about app components.
- The global stylesheet: the theme imports, `html { font-size: 62.5%; }` and `@layer base` rules
  stay.
- CSS that no utility expresses.

## When you are done

Run the type check, the lint task and the build of every project you changed, and look at each
changed view in the browser: a missed class renders unstyled, not as an error.

The rule is also summarised under "Styles" in <https://ethlete-sdk-docs.web.app/components/setup>, and
overriding SDK styles under "Overriding component styles" in
<https://ethlete-sdk-docs.web.app/components/>.
