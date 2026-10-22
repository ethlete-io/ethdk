# Proposal: one rule for color per surface

Status: accepted on 2026-10-22 with the recommendations of the open questions. Slice 1 (core runtime,
Storybook surfaces, docs) and slice 2 (the codemod) are done. The root swap is a later slice.

## The problem

A colleague asked how to stop a segmented button from using the surface's `colorTheme`. The
question shows the problem: the theming has too many rules that change a color by surface, and
nobody can tell which rule wins.

Today a surface theme has three fields that affect color:

| Field                 | What it does now                                                        |
| --------------------- | ----------------------------------------------------------------------- |
| `colorTheme`          | Paints a color theme on the subtree, unless an `[etProvideColor]` wins. |
| `semanticColorThemes` | Picks the theme for `success`, `warning` or `error` on this surface.    |
| `interactionColor`    | The surface's own grey: hover tints and `color="surface"`.              |

A named accent, for example `grey` with a `grey-light` version, fits none of them.

## The model: two rules

1. **A surface is where an element sits.** It has a background, text, borders and its own grey.
   `color="surface"` and the hover tints use that grey. This is `interactionColor`, and it stays.
2. **A color is an accent that you choose.** A surface can swap an accent for a version that
   reads well on it.

Everything else uses these two rules:

- The default color is an accent that nobody chose explicitly.
- `success`, `warning` and `error` are accents with a `type`.

## The new field

Rule 2 becomes one field, `colorThemeVariants`. It replaces `colorTheme` and
`semanticColorThemes`. The keys and the values are color theme names only.

Before:

```ts
export const LIGHT_SURFACE = {
  name: 'light',
  type: 'light',
  colorTheme: 'brand-on-light',
  semanticColorThemes: { error: 'danger-on-light', success: 'success-on-light', warning: 'warning-on-light' },
} satisfies SurfaceTheme;

export const DARK_SURFACE = {
  name: 'dark',
  type: 'dark',
  colorTheme: 'brand',
} satisfies SurfaceTheme;
```

After:

```ts
export const LIGHT_SURFACE = {
  name: 'light',
  type: 'light',
  colorThemeVariants: {
    brand: 'brand-on-light',
    danger: 'danger-on-light',
    success: 'success-on-light',
    warning: 'warning-on-light',
    grey: 'grey-light',
  },
} satisfies SurfaceTheme;

export const DARK_SURFACE = {
  name: 'dark',
  type: 'dark',
} satisfies SurfaceTheme;
```

## How a color resolves

1. Find the chosen accent. This is the nearest `[etProvideColor]`, or the default theme if there is
   none. For a semantic lookup, it is the theme with that `type`.
2. Find the nearest surface. If its `colorThemeVariants` has an entry for the chosen accent, use
   that entry. If it has no entry, use the chosen accent.

The swap always starts from the chosen accent, never from a swapped one. Therefore a dark surface
inside a light surface draws `brand` again with no entry. Today each dark surface must set
`colorTheme: 'brand'` to undo the light swap, and the docs warn about it.

There is no precedence rule between the surface and `[etProvideColor]` any more. The colleague's
case then works with no opt-out:

```html
<et-segmented-button-group color="grey">…</et-segmented-button-group>
<!-- on a light surface: grey-light. On a dark surface: grey. -->
```

To keep an accent fixed on every surface, do not give it an entry.

## Which to use

| You want                                         | Use                                                 |
| ------------------------------------------------ | --------------------------------------------------- |
| A neutral color that follows the surface         | `color="surface"`, values from `interactionColor`   |
| An accent with a better version on some surfaces | `color="<name>"`, plus `colorThemeVariants` entries |
| An accent that stays the same on every surface   | `color="<name>"`, with no entry                     |

## Migration

- `colorTheme` and `semanticColorThemes` stay for one release, deprecated, and keep their behavior.
- A codemod converts them. `colorTheme: X` becomes `{ <default theme name>: X }`.
  `semanticColorThemes: { success: X }` becomes `{ <name of the success theme>: X }`.
- A `colorTheme` that only repeats the default theme, for example `colorTheme: 'brand'` on the dark
  Storybook surfaces, is removed.
- The migration is optional, so the codemod is a hand-run generator,
  `nx g @ethlete/core:migrate-color-theme-variants`. `et update` does not run it.

## What I checked

- Storybook: `light` and `light-elevated` have the same mappings. The dark surfaces set
  `colorTheme: 'brand'` only to undo the light swap. No surface needs a different variant per
  elevation.
- fut-frontend: it registers only dark surfaces, and it uses neither old field.

## Open questions

1. **The root.** `:root` has no surface element, so the root needs an `[etProvideSurface]` for
   the swap. This is the same limit as `colorTheme` today. Should `provideColorScheme()` also swap
   the default accent on `:root`? Recommendation: yes, but as a later slice.
2. **Behavior change.** Today `[etProvideColor]="'grey'"` above a light surface keeps `grey` inside
   it. After the change, the surface swaps it to `grey-light` if an entry exists. Recommendation:
   accept this. It is the behavior the colleague expected.
3. **The name.** `colorThemeVariants` or `colorThemeSwaps`. Recommendation: `colorThemeVariants`.

## Slice 1 design (runtime)

- `SurfaceTheme.colorThemeVariants?: Partial<Record<RegisteredColorThemeName, RegisteredColorThemeName>>`.
  `colorTheme` and `semanticColorThemes` get `@deprecated` and keep working through the same resolver.
- One pure resolver in `libs/core/src/lib/theming/color-theme.util.ts`:
  `resolveColorThemeVariant(surface, chosenName, themes)`. Order: `colorThemeVariants[chosen]`, then the
  deprecated `semanticColorThemes[type of chosen]`, then the deprecated `colorTheme` if `chosen` is the
  `isDefault` theme, then `chosen`. `surface` (the reserved name) never swaps. A null surface never swaps.
- `ProvideColorDirective`: `resolvedColor()` stays the chosen, unswapped accent, so overlay sync and nested
  providers pass the chosen name on. The painted class becomes `et-color--<swap(own name, nearest surface)>`.
  Read the nearest surface lazily inside the computed with `injector.get(SURFACE_PROVIDER, null)`. A
  field-level `inject(SURFACE_PROVIDER)` makes a DI cycle, because `ProvideSurfaceDirective` injects
  `COLOR_PROVIDER` on the same element.
- `ProvideSurfaceDirective`: chosen = nearest color provider's `resolvedColor()` name (self included), else the
  `isDefault` theme name. It paints `et-color--<swap(chosen, own activeTheme)>` only when that differs from
  `swap(chosen, parent surface activeTheme)` (parent = `SURFACE_PROVIDER` with `skipSelf`; no parent = no swap).
  Whatever sits between two surfaces already painted `swap(chosen, parent surface)`, so this comparison is
  exact. Skip it when a color provider on the same element has its own color; that one paints.
- `injectSemanticColorTheme(type)`: theme of `type`, then the resolver on the nearest surface.
- Accepted behavior change: an explicit `[etProvideColor]="'brand'"` above a light surface is now swapped
  inside it, where before an explicit color blocked `colorTheme`.
