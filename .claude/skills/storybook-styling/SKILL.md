---
name: storybook-styling
description: How to style Storybook story files in this repo — where Tailwind is (and isn't) allowed, and which utilities actually exist in the playground's trimmed Tailwind theme (most of the default palette and text scale do not). Read BEFORE writing or editing any `*.stories.ts` / `stories/` component, or when a class in a story renders with no visible effect.
---

# Styling story files

Two separate rules, often confused:

1. **Component source is plain CSS, never Tailwind.** The `.css` next to a
   component, wrapped in `@layer components`, using surface/color tokens — see the
   **`theming`** skill.
2. **Story files may use Tailwind** (`*.stories.ts`, anything under a `stories/`
   folder) for demo layout only — the frame around the component, not the
   component's own look.

The trap is rule 2's small print: the playground ships a **trimmed** Tailwind
theme, so a large part of what you'd type from muscle memory silently does
nothing. Tailwind emits no class for an unknown token; there is no error, the
element just renders unstyled.

## The theme: `apps/playground/src/styles/storybook.css`

That file is the whole story-side design system: it imports Tailwind, sets the
`@theme`, then pulls in `themes.css` / `surface-themes.css` (the generated theme
vars). Read it before reaching for an unfamiliar utility. What it does:

```css
--color-*: initial; /* the entire default palette is GONE */
--font-*: initial;
--text-*: initial;
--spacing: 0.4rem;
```

| Group        | What exists                                                                                                    | What silently does nothing                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Colors       | `white`, `black` only — so `bg-black/5`, `text-white`, `border-white/10`                                        | every palette class: `bg-blue-500`, `text-purple-700`, `bg-gray-500/15` |
| Text sizes   | `text-h1`…`text-h6`, `text-huge`, `text-extra-large`, `text-large`, `text-base`, `text-medium`, `text-small`, `text-subline` | Tailwind's own scale: `text-xs`, `text-sm`, `text-lg`, `text-xl`         |
| Fonts        | `font-sans` (Archivo), `font-display` (Stretch Pro), `font-title` (Tusker Grotesk)                             | `font-mono`, `font-serif`                                             |
| Spacing      | `--spacing: 0.4rem`, so `p-8` = 3.2rem, `gap-2` = 0.8rem                                                       | —                                                                     |
| Layout, flex, grid, radius, opacity, borders | untouched Tailwind defaults                                                       | —                                                                     |

Check before you guess — if `@theme` doesn't define the token, the class doesn't exist:

```bash
grep -nE -- '--(color|text|font)-' apps/playground/src/styles/storybook.css
```

## Colors in a story come from theming, not utilities

There is no palette to reach for, and that is deliberate: a story renders inside a
**surface theme** and a **color theme**, so any color it paints must come from those
tokens — same rule as component CSS (the **`theming`** skill is the reference for the
token names).

- A tinted panel: put `etAutoSurface` on it (next elevation up) and read the token:
  `style="background: var(--et-surface-background-solid)"`. That's how the table
  story's expanded-row panel and its nested sub-table are painted.
- An accent: scope it with `[etProvideColor]="'brand'"` and read
  `--et-theme-color-primary-solid` / `--et-theme-color-ink-solid`. Theme names
  (`brand`, `danger`, `success`, `neutral`) are what **the playground** registers
  (`apps/playground/src/themes.ts`) — fine to name in a story, never in library code.
- Better still: don't hand-paint. Compose the library component that already does it
  (`<et-chip>` for a badge cell, `<et-button>` for an action) — that's also what a
  consumer would write.
- **Never `dark:`.** It resolves to `prefers-color-scheme`, which knows nothing about
  the surface theme the story is rendered on: a story on the `dark` surface would keep
  its light styling on an OS in light mode. Elevation and light/dark come from
  `[etProvideSurface]` / `etAutoSurface`.

## The 62.5% root font

`storybook.css` sets `html { font-size: 62.5% }`, so `1rem` = 10px.
Every rem-based utility is therefore 62.5% of its nominal px
value, which mostly *reads* fine because `--spacing` is scaled to match, but bites on
the container scale: `max-w-3xl` is 480px, not 768px, and will truncate a demo you
sized by eye.

For a demo frame whose width matters, bind px instead of guessing a `max-w-*`:

```html
<div [style.max-inline-size.px]="768" class="p-8 font-sans">…</div>
```

## Checklist for a story you just wrote

- Utilities only for layout/spacing/typography; the component's own look comes from the component.
- Every color class is `white`/`black`-based, or is a theme token — no palette names.
- Text sizes from the repo scale (`text-small`, `text-medium`, …), not `text-sm`/`text-xs`.
- No `dark:` variants.
- Width/height that matters is px, not the rem container scale.
- Then verify it actually renders — the **`verify-in-storybook`** skill.
