# Style app components with Tailwind utilities

The earlier guidance left app styling open, so app components were often styled with a BEM class
system or a `.css` file per component. The `app-styling` rule now says: every app component is laid
out and styled with Tailwind utility classes in its template, and CSS is written only for what a
utility cannot express.

## Before you start

`et update` regenerates the agent rules when it moves `@ethlete/agent-rules`. If this repo has no
`app-styling` rule yet (in `AGENTS.md`, or under `.claude/rules/ethlete/`), run
`ethlete-agents sync` with this repo's package manager (`yarn`, `pnpm exec` or `npx`) first, then read the rule.

Then read this repo's own styling rules: a styleguide under `docs/`, a `CONTRIBUTING.md`, lint
config for CSS, and the parts of `AGENTS.md` outside the generated block. Where they conflict with
this task, such as shared app classes listed as the building blocks to use, or a ban on `rem` in own
CSS while step 1 sets a rem-based `--spacing`, stop and ask the user which one wins. Do not override
the repo's rules silently, and do not edit them without that answer.

## Find the call sites

The components with a stylesheet, whatever their file suffix:

```bash
grep -rlE 'styleUrls?:' apps libs --include='*.ts'
```

The stylesheets those components reference. This leaves out the global stylesheets (the `styles`
of a build target, and the files they `@import`) and generated theme files:

```bash
grep -rlE 'styleUrls?:' apps libs --include='*.ts' | while read -r file; do
  grep -oE "['\"][^'\"]+\.(css|scss|sass|less)['\"]" "$file" | tr -d "'\"" |
    while read -r sheet; do realpath -m --relative-to=. "$(dirname "$file")/$sheet"; done
done | sort -u
```

BEM classes in templates, class bindings, `routerLinkActive` and host classes, app rules in
`@layer components` (global stylesheets included), and the components that do not set
`ViewEncapsulation.None` yet:

```bash
grep -rnE 'class="[^"]*\b[a-z0-9-]+__[a-z0-9-]+' apps libs --include='*.html' --include='*.ts'
grep -rnE '\[class\.[a-z0-9_-]+\]|\[ngClass\]|\[class\]=' apps libs --include='*.html' --include='*.ts'
grep -rnE 'routerLinkActive="[^"]+"' apps libs --include='*.html' --include='*.ts'
grep -rnE "(host: \{|'\[class(\.[a-z0-9_-]+)?\]'|class: ')" apps libs --include='*.ts'
grep -rlE '@layer components' apps libs --include='*.css' --include='*.scss'
grep -rlE '@Component\(' apps libs --include='*.ts' | xargs grep -LE 'ViewEncapsulation\.None'
```

## What to change

1. Check the root font size and the spacing scale first. On the 10px root the SDK needs, Tailwind's
   rem scales are 1.6× smaller than their nominal size. Set `--spacing: 0.4rem` in the app's
   `@theme` so that `p-4` is 16px again, and redefine any other rem scale the templates use
   (`--text-*`, `--container-*`, `--radius-*`). This rescales the utilities the app already uses,
   so check the views that have them.
2. Replace each class that sets layout, spacing, sizing or typography with the utilities in the
   template, and delete the rule from the stylesheet.
3. Replace a hardcoded colour with a theme utility or a `var(--et-…)` token. The surface utilities
   are `bg-et-surface-bg`, `text-et-surface`, `text-et-surface-muted`, `text-et-surface-subtle` and
   `border-et-surface-border`. The colour utilities resolve against the nearest `[etProvideColor]`
   scope: `bg-et-theme`, `text-et-on-theme` for text on that fill, and `text-et-theme-ink` or
   `border-et-theme-ink` on a transparent background. Each has `-hover`, `-focus`, `-active` and
   `-disabled` variants. A utility with a theme name in it (`bg-et-<name>`) pins one theme and
   ignores the scope, so prefer the scoped ones.
4. Keep what utilities cannot express (a keyframe, a complex selector) as CSS, unlayered or in
   `@layer utilities`. Move any app rule out of `@layer components`: SDK styles land in that layer
   after yours, so the app rule loses. This applies to the `@layer components` blocks in the global
   stylesheet too: shared app classes there are app components, and move to utilities in the
   templates that use them.
5. Find the app's unlayered overrides of SDK classes (`.et-button`, `.et-badge`, …) in the global
   stylesheet and in component sheets:

   ```bash
   grep -rnE '(^|[ ,>+~])\.et-[a-z0-9-]+' apps libs --include='*.css' --include='*.scss'
   ```

   Unlayered CSS beats every layer, so such a rule beats the utilities you add on the same element.
   Replace it with the component's `--et-*` tokens or a utility on the element. A rule that has to
   stay goes into `@layer utilities`, like the CSS in step 4: it then still beats the SDK's
   `@layer components`, and no longer beats every utility.

6. To restyle an SDK component, set its `--et-*` tokens first, then a utility on the element.
7. Delete a stylesheet that ends up empty, and its `styleUrl`.
8. Keep `encapsulation: ViewEncapsulation.None` on every app component, and add it where it is
   missing: the `require-view-encapsulation-none` lint rule requires it. The CSS that is left is then
   global, so give the component a host class (`host: { class: 'app-…' }`) and scope every selector
   under it, the way the SDK scopes its CSS under `et-` classes.

## Watch the initial bundle

A component stylesheet ships with its component, so a lazy route's CSS loads with that route. The
utilities go into the global stylesheet, which is part of the initial bundle. Moving many lazy
components to utilities can push the initial bundle over its budget. Check the build's initial
total against the budget after each batch. Keep the stylesheet of a lazy component whose CSS is
large and used nowhere else, and report the trade-off rather than raising the budget on your own.

## Leave these alone

- A library that ships its own CSS to other repos. The rule is about app components.
- In the global stylesheet: the Tailwind and theme imports, `@theme`, `html { font-size: 62.5%; }`
  and the `@layer base` rules for elements (`html`, `body`, `a`).
- Generated theme files, such as the surface and colour themes `@ethlete/core` writes.
- CSS that no utility expresses.

## When you are done

Run the type check, the lint task and the build of every project you changed, and look at each
changed view in the browser: a missed class renders unstyled, not as an error.

The page the `Docs` line at the top of this file links (`/components/setup` on the SDK docs site)
summarises the rule under "Styles". Overriding SDK styles is under "Overriding component styles" on
`/components/`, on the same site.
