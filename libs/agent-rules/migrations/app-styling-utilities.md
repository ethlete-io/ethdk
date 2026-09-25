# Style app components with Tailwind utilities

The earlier guidance left app styling open, so app components were often styled with a BEM class
system or a `.css` file per component. The `app-styling` rule now says: every app component is laid
out and styled with Tailwind utility classes in its template, and CSS is written only for what a
utility cannot express.

## Before you start

`et update` regenerates the agent rules when it moves `@ethlete/agent-rules`. If this repo has no
`app-styling` rule yet (in `AGENTS.md`, or under `.claude/rules/ethlete/`), run
`ethlete-agents sync` with this repo's package manager (`yarn`, `pnpm exec` or `npx`) first, then read the rule.

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

BEM classes in templates, app rules in `@layer components` (global stylesheets included), and the
components that turned off view encapsulation:

```bash
grep -rnE 'class="[^"]*\b[a-z0-9-]+__[a-z0-9-]+' apps libs --include='*.html' --include='*.ts'
grep -rlE '@layer components' apps libs --include='*.css' --include='*.scss'
grep -rlE 'ViewEncapsulation\.None' apps libs --include='*.ts'
```

## What to change

1. Check the root font size and the spacing scale first. On the 10px root the SDK needs, Tailwind's
   rem scales are 1.6× smaller than their nominal size. Set `--spacing: 0.4rem` in the app's
   `@theme` so that `p-4` is 16px again, and redefine any other rem scale the templates use
   (`--text-*`, `--container-*`, `--radius-*`). This rescales the utilities the app already uses,
   so check the views that have them.
2. Replace each class that sets layout, spacing, sizing or typography with the utilities in the
   template, and delete the rule from the stylesheet.
3. Replace a hardcoded colour with a theme utility (`bg-et-surface-bg`, `border-et-surface-border`,
   `text-et-<theme>`) or a `var(--et-…)` token.
4. Keep what utilities cannot express (a keyframe, a complex selector) as CSS, unlayered or in
   `@layer utilities`. Move any app rule out of `@layer components`: SDK styles land in that layer
   after yours, so the app rule loses. This applies to the `@layer components` blocks in the global
   stylesheet too: shared app classes there are app components, and move to utilities in the
   templates that use them.
5. To restyle an SDK component, set its `--et-*` tokens first, then a utility on the element.
6. Delete a stylesheet that ends up empty, and its `styleUrl`.
7. Remove `encapsulation: ViewEncapsulation.None` from each app component. Keep it only when the CSS
   that is left must reach elements the component does not render itself, such as an overlay or an
   SDK component's internals, and scope every selector under the component's host class.

## Leave these alone

- A library that ships its own CSS to other repos, and component source in an SDK-style library
  built with `ViewEncapsulation.None`. The rule is about app components.
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
