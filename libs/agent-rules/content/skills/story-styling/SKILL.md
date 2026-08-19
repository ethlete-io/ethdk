---
name: story-styling
description: How to style Storybook story files - where Tailwind is (and isn't) allowed, and how to check which utilities actually exist in your trimmed Tailwind theme before reaching for one. Read BEFORE writing or editing any `*.stories.ts` / `stories/` component, or when a class in a story renders with no visible effect.
kind: skill
scope: consumer
requires: ['@ethlete/core']
paths: ['**/*.stories.ts', '**/stories/**']
vars: [themeStylesheet]
---

# Styling story files

Two separate rules, often confused:

1. **Component source is plain CSS, never Tailwind.** The `.css` next to a
   component, wrapped in `@layer components`, using surface/color tokens - see
   {%skill:theming%}.
2. **Story files may use Tailwind** (`*.stories.ts`, anything under a `stories/`
   folder) for demo layout only - the frame around the component, not the
   component's own look.

## The trap: an unknown utility fails silently

A Tailwind v4 `@theme` that resets a token group deletes every utility built from
it. Tailwind then emits **no class at all** for the name you typed - there is no
error and no warning, the element just renders unstyled. A theme that does this:

```css
--color-*: initial; /* the entire default palette is GONE */
--text-*: initial; /* the entire default type scale is GONE */
```

leaves `bg-blue-500`, `text-gray-700` and `text-sm` as dead strings, even though
they are "real" Tailwind classes.

**Read the theme before reaching for an unfamiliar utility.** This project's is
`{%themeStylesheet%}`:

```bash
grep -nE -- '--(color|text|font|spacing)-' {%themeStylesheet%}
```

If `@theme` doesn't define the token, the class doesn't exist. Check rather than
guess, and prefer utilities from groups the theme leaves untouched (layout, flex,
grid, radius, opacity, borders) over ones it redefines.

Watch the root font size too: a theme that sets `html { font-size: 62.5% }` makes
`1rem` = 10px, so every rem-based utility is 62.5% of its nominal value. That mostly
reads fine when `--spacing` is scaled to match, but it bites on the container scale -
`max-w-3xl` becomes 480px, not 768px, and silently truncates a demo you sized by eye.
When a width or height actually matters, bind px:

```html
<div [style.max-inline-size.px]="768" class="p-8">…</div>
```

## Colours in a story come from theming, not utilities

A story renders inside a **surface theme** and a **colour theme**, so any colour it
paints must come from those tokens - the same rule as component CSS
({%skill:theming%} is the reference for the token names).

- A tinted panel: put `etAutoSurface` on it (next elevation up) and read the token:
  `style="background: var(--et-surface-background-solid)"`.
- An accent: scope it with `[etProvideColor]="storyAccentTheme"` and read
  `--et-theme-color-primary-solid` / `--et-theme-color-ink-solid`. Theme names are
  whatever **your app** registers - fine to name in a story, never in library code.
- Better still: don't hand-paint. Compose the component that already does it
  (`<et-chip>` for a badge, `<et-button>` for an action) - that's also what a real
  consumer would write.
- **Never `dark:`.** It resolves to `prefers-color-scheme`, which knows nothing about
  the surface theme the story is rendered on: a story on a dark surface would keep its
  light styling on an OS in light mode. Elevation and light/dark come from
  `[etProvideSurface]` / `etAutoSurface`.

## Checklist for a story you just wrote

- Utilities only for layout/spacing/typography; the component's own look comes from the component.
- Every colour is a theme token, or a utility built on a token the theme still defines.
- Text sizes from your theme's scale, not Tailwind's default `text-sm`/`text-xs`.
- No `dark:` variants.
- Width/height that matters is px, not the rem container scale.
- Then verify it actually renders with the repository's installed Storybook verification
  workflow, or inspect the story directly when no such guide was emitted.
